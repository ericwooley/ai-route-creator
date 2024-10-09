import { DynamicStructuredTool } from '@langchain/core/tools'
import { z, ZodTypeAny } from 'zod'
import axios from 'axios'
import puppeteer from 'puppeteer'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { ChatOpenAI } from '@langchain/openai'
import { cache, redis } from '../cache'
import { PromptTemplate } from '@langchain/core/prompts'
import { StructuredOutputParser } from '@langchain/core/output_parsers'
import pdf from 'pdf-parse'
import { TokenTextSplitter } from 'langchain/text_splitter'

const textSplitter = new TokenTextSplitter({
  chunkSize: 22000,
  chunkOverlap: 500,
})

const log =
  (ctx: string, verbose: boolean) =>
  (...args: any[]) =>
    verbose ? console.warn(ctx + ':', ...args) : null

async function getPdfContent(url: string): Promise<string> {
  try {
    // Fetch the PDF as a binary stream
    const response = await axios.get(url, {
      headers: {
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-language': 'en-US,en;q=0.9',
        'cache-control': 'max-age=0',
        'if-modified-since': 'Mon, 06 Aug 2007 15:23:56 GMT',
        'if-none-match': '"22f44-1197b-437097f405b00"',
        'upgrade-insecure-requests': '1',
        'User-Agent': `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36`,
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      responseType: 'arraybuffer',
    })

    // Parse the PDF content
    const data = await pdf(response.data)

    // Return the extracted text
    return data.text
  } catch (error) {
    console.error('Error fetching or parsing PDF:', error.message)
    return ''
  }
}

const questionOutputParser = StructuredOutputParser.fromZodSchema(
  z.string().describe('The question that the user is trying to answer')
)
export const defaultLLM = new ChatOpenAI({ maxConcurrency: 10, temperature: 0, cache: cache, model: 'gpt-4o-mini' })

const answerQualitySchema = z
  .union([
    z.literal('1').describe('The answer is not relevant to the question'),
    z.literal('2').describe('The answer is barely relevant to the question'),
    z.literal('3').describe('The answer is somewhat relevant to the question'),
    z.literal('4').describe('The answer is moderately relevant to the question'),
    z.literal('5').describe('The answer is relevant to the question'),
    z.literal('6').describe('The answer is quite relevant to the question'),
    z.literal('7').describe('The answer is very relevant to the question'),
    z.literal('8').describe('The answer is highly relevant to the question'),
    z.literal('9').describe('The answer is almost perfect for the question'),
    z.literal('10').describe('The answer is perfect for the question'),
  ])
  .describe('The quality of the answer, on a scale from 1 to 10')
const answerSchema = z.object({
  answerQualityExplanation: z.string().describe('An explanation of the answer quality, why it is rated as such'),
  answer: z.string().describe('The answer to the question'),
  answerQuality: answerQualitySchema,
  snippet: z.string().describe('The snippet of text that the answer was extracted from.'),
})
export type Answer = z.infer<typeof answerSchema> & {
  query: string
  link: string
}
const answerParser = StructuredOutputParser.fromZodSchema(answerSchema.describe("The answer to the user's question"))
const answerQuestionFromQueryPrompt = PromptTemplate.fromTemplate(
  `
  The user is trying to answer the following query. Given this content, what is the answer?

  Keep the answer as short and terse as possible.
  Original Query: {query}
  Content:
  ~~~
  {content}
  ~~~
  {output_instructions}

  `.trim()
)

const finalAnswerPrompt = PromptTemplate.fromTemplate(
  `
  We have scoured the internet trying to find the highest quality answers to the user's query. Here are the best answers we could find.
  Original Query: {query}

  You are to look through these answers and give a definitive answer to the user. Do not use a range (unless the user is looking for a range specifically), or multiple answers (unless the query is requesting a list or multiple answers specifically), give a definitive answer to the query, that the user can use to solve their problem.
  ~~~
  {answers}
  ~~~

  If there are no good answers, make an educated guess based on the results.

  {output_instructions}

  `.trim()
)

export const createSearchTool = <T extends ZodTypeAny>({
  responseSchema,
  verbose,
  llm = defaultLLM,
  name = 'internet search',
  description = 'Searches google and returns results as parsed by the first x results',
  transform = (result) => result,
}: {
  name?: string
  description?: string
  responseSchema: T
  llm?: BaseChatModel
  verbose: boolean
  transform?: (result: z.infer<T>) => any
}) =>
  new DynamicStructuredTool({
    name,
    description,
    schema: z.object({
      query: z.string().min(1),
    }),

    func: async ({ query }) => {
      const logVerbose = log(query, verbose)
      const cacheKey = name + `:search-${query}`
      const cachedResponse = await redis.get(cacheKey)
      if (cachedResponse) {
        const finalAnswer = transform(JSON.parse(cachedResponse).finalAnswer)
        logVerbose('Using cached response:', JSON.stringify(finalAnswer, null, 2))
        return finalAnswer
      }
      logVerbose('Searching for:', query)
      const results = await searchGoogle({ query, verbose, name })
      if (!results) {
        return null
      }
      logVerbose('Results:', results.items.length)
      const answers = await boilDownResults({
        llm,
        context: `${name} - ${description}`,
        verbose,
        query,
        results,
        resultSchema: responseSchema,
      })
      logVerbose('Final Answer:', answers.finalAnswer, answers.answers)
      await redis.set(cacheKey, JSON.stringify(answers), 'EX', 60 * 60 * 24 * 7)
      const finalAnswer = transform(answers.finalAnswer)
      logVerbose('Final Answer:', finalAnswer)
      return finalAnswer
    },
  })

interface SearchResult {
  kind: string
  url: {
    type: string
    template: string
  }
  queries: {
    request: Array<{
      title: string
      totalResults: string
      searchTerms: string
      count: number
      startIndex: number
      inputEncoding: string
      outputEncoding: string
      safe: string
      cx: string
    }>
  }
  items: Array<{
    kind: string
    title: string
    htmlTitle: string
    link: string
    displayLink: string
    snippet: string
    htmlSnippet: string
    cacheId: string
    formattedUrl: string
    htmlFormattedUrl: string
  }>
}

export async function searchGoogle({
  query,
  verbose,
  name = 'internet search',
}: {
  query: string
  verbose: boolean
  name?: string
}): Promise<SearchResult | null> {
  const logVerbose = log(query, verbose)

  const apiKey = process.env.GOOGLE_SEARCH_API_KEY
  const cx = '57ac4e5ba214b44a4' // Programmable Search Engine ID

  if (!apiKey || !cx) {
    console.error('API key or CX is missing')
    return null
  }

  try {
    const response = await axios.get<SearchResult>('https://customsearch.googleapis.com/customsearch/v1', {
      params: {
        key: apiKey,
        cx: cx,
        q: query,
      },
    })
    return response.data
  } catch (error) {
    console.error('Error fetching search results:', error)
    return null
  }
}

export async function boilDownResults<T extends ZodTypeAny>({
  query,
  results,
  llm = defaultLLM,
  limit = 5,
  resultSchema = z.string() as any as T,
  verbose = false,
  context,
}: {
  context: string
  query: string
  results: SearchResult
  llm?: BaseChatModel
  limit?: number
  resultSchema?: T
  verbose?: boolean
}) {
  const logVerbose = log(query, verbose)
  // const question = await getQuestionFromQueryPrompt
  //   .pipe(llm)
  //   .pipe(questionOutputParser)
  //   .invoke({ context, query, output_instructions: questionOutputParser.getFormatInstructions() })

  const browser = await puppeteer.launch({
    timeout: 10000,
  })
  try {
    let answers: Array<Answer> = []
    await Promise.all(
      results.items.slice(0, limit).map(async (item) => {
        const page = await browser.newPage()
        page.setViewport({ width: 1920, height: 1080 })
        page.setExtraHTTPHeaders({
          accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'accept-language': 'en-US,en;q=0.9',
          'cache-control': 'max-age=0',
          'if-modified-since': 'Mon, 06 Aug 2007 15:23:56 GMT',
          'if-none-match': '"22f44-1197b-437097f405b00"',
          'upgrade-insecure-requests': '1',
        })
        page.setUserAgent(
          `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36`
        )

        try {
          logVerbose('Processing page: ' + item.link)
          let content = await redis.get(`content-${item.link}`)
          if (!content) {
            if (item.link.toLowerCase().endsWith('.pdf')) {
              content = await getPdfContent(item.link)
            } else {
              await page.goto(item.link)
              await page.waitForNetworkIdle()
              // Extract the content of the 'main' element
              content = await page.evaluate(() => {
                let mainElement = document.querySelector('main')
                mainElement = mainElement ?? document.querySelector('#main')
                mainElement = mainElement ?? document.querySelector('#content')
                mainElement = mainElement ?? document.querySelector('body')
                return mainElement ? mainElement.innerText : ''
              })
            }

            if (!content || content.length < 10) {
              logVerbose('No content found on page: ' + item.link)
              return
            }
            redis.set(`content-${item.link}`, content, 'EX', 60 * 60 * 24 * 7)
          }
          const splitDocs = await textSplitter.splitText(content)

          logVerbose('Checking page for answer...' + item.link)
          const possibleAnswers = await Promise.all(
            splitDocs.map(async (doc, index) => {
              logVerbose('Checking doc for link', item.link, `chunck: ${index + 1}/${splitDocs.length}`)
              return await answerQuestionFromQueryPrompt.pipe(llm).pipe(answerParser).invoke({
                output_instructions: answerParser.getFormatInstructions(),
                content: doc,
                query,
              })
            })
          )
          const highestQualityAnswer = possibleAnswers.reduce((prev, current) => {
            return prev.answerQuality > current.answerQuality ? prev : current
          }, possibleAnswers[0])
          if (parseInt(highestQualityAnswer?.answerQuality ?? '0') > 3) {
            answers.push({ ...highestQualityAnswer, link: item.link, query })
          }
        } catch (e) {
          console.warn('Error processing page: ' + item.link, e.message)
        }
      })
    )
    const finalAnswerSchema = z.object({
      finalAnswer: resultSchema.describe(
        (
          'The answer to the user query, do not use a range, or multiple answers, give a definitive answer to the query, that the user can use to solve their problem. If the answer is not known from the search, make an educated guess, and mark the quality as 1' +
          (resultSchema.description ?? '')
        ).trim()
      ),
      finalAnswerQuality: answerQualitySchema.describe('The quality of the final answer'),
      relevantLinks: z.array(z.string()).describe('Links to relevant information used to answer the query'),
      mostUsefulAnswers: z.array(answerSchema).describe('The most useful answers to the user query'),
    })
    const finalOutputStructure = StructuredOutputParser.fromZodSchema(finalAnswerSchema)
    const finalAnswer = await finalAnswerPrompt
      .pipe(llm)
      .pipe(finalOutputStructure)
      .invoke({
        query,
        answers: answers.map((answer) => JSON.stringify(answer)).join('\n\n'),
        output_instructions: finalOutputStructure.getFormatInstructions(),
      })
    return {
      finalAnswer,
      answers,
    }
  } finally {
    await browser.close()
  }
}
