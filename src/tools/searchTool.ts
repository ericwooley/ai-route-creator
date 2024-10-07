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
  (verbose: boolean) =>
  (...args: any[]) =>
    verbose ? console.warn(...args) : null

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
export const defaultLLM = new ChatOpenAI({ maxConcurrency: 2, temperature: 0, cache: cache, model: 'gpt-4o-mini' })
const getQuestionFromQueryPrompt = PromptTemplate.fromTemplate(
  `
Given the following search query, what question do you think the user is trying to answer?

Answer as a short question that is similar to the query.

{output_instructions}

For Example:
Query: How to make a cake
Question: What are the steps to make a cake?

You answer should only be the question and no other information.
Query: {query}
Question:
  `.trim()
)
const answerSchema = z.object({
  question: z.string().describe('The question that the user is trying to answer'),
  answerQualityExplanation: z.string().describe('An explanation of the answer quality, why it is rated as such'),
  answer: z.string().describe('The answer to the question'),
  answerQuality: z
    .union([
      z.literal(1).describe('The answer is not relevant to the question'),
      z.literal(2).describe('The answer is barely relevant to the question'),
      z.literal(3).describe('The answer is somewhat relevant to the question'),
      z.literal(4).describe('The answer is moderately relevant to the question'),
      z.literal(5).describe('The answer is relevant to the question'),
      z.literal(6).describe('The answer is quite relevant to the question'),
      z.literal(7).describe('The answer is very relevant to the question'),
      z.literal(8).describe('The answer is highly relevant to the question'),
      z.literal(9).describe('The answer is almost perfect for the question'),
      z.literal(10).describe('The answer is perfect for the question'),
    ])
    .describe('The quality of the answer, on a scale from 1 to 10'),
})
export type Answer = z.infer<typeof answerSchema> & {
  query: string
  presumedQuestion: string
  link: string
}
const answerParser = StructuredOutputParser.fromZodSchema(answerSchema.describe("The answer to the user's question"))
const answerQuestionFromQueryPrompt = PromptTemplate.fromTemplate(
  `
  The user is trying to answer the following question. Given this content, what is the answer?

  Keep the answer as short and terse as possible.
  Original Query: {query}
  Presumed Question: {question}
  Content:
  ~~~
  {content}
  ~~~
  {output_instructions}

  `.trim()
)

const finalAnswerSchema = z
  .string()
  .describe(
    'The answer to the user query, do not use a range, or multiple answers, give a definitive answer to the question, that the user can use to solve their problem'
  )

const finalAnswerPrompt = PromptTemplate.fromTemplate(
  `
  We have scoured the internet trying to find the highest quality answers to the user's question. Here are the best answers we could find.
  Original Query: {query}
  Presumed Question: {question}
  You are to look through these answers and give a definitive answer to the user. Do not use a range, or multiple answers, give a definitive answer to the question, that the user can use to solve their problem.
  ~~~
  {answers}
  ~~~
  {output_instructions}

  `.trim()
)

export const searchTool = <T extends ZodTypeAny>({
  responseSchema,
  verbose,
}: {
  responseSchema: T
  verbose: boolean
}) =>
  new DynamicStructuredTool({
    name: 'internet search',
    description: 'Searches google and returns results as parsed by the first x results',
    schema: z.object({
      query: z.string().min(1),
    }),

    func: async ({ query }) => {
      const results = await searchGoogle({ query, verbose })
      if (!results) {
        return null
      }
      const answers = await boilDownResults({ verbose, query, results, resultSchema: responseSchema })
      return answers
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
}: {
  query: string
  verbose: boolean
}): Promise<SearchResult | null> {
  const logVerbose = log(verbose)
  let cacheResponse = await redis.get(`search-${query}`)
  if (cacheResponse) {
    return JSON.parse(cacheResponse)
  }

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
    logVerbose(response.statusText, response.data)
    // cache for 1 week
    await redis.set(`search-${query}`, JSON.stringify(response.data), 'EX', 60 * 60 * 24 * 7)
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
  limit = 20,
  resultSchema = finalAnswerSchema as any as T,
  verbose = false,
}: {
  query: string
  results: SearchResult
  llm?: BaseChatModel
  limit?: number
  resultSchema?: T
  verbose?: boolean
}) {
  const logVerbose = log(verbose)
  const question = await getQuestionFromQueryPrompt
    .pipe(llm)
    .pipe(questionOutputParser)
    .invoke({ query, output_instructions: questionOutputParser.getFormatInstructions() })

  const browser = await puppeteer.launch({
    timeout: 10000,
  })
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
        let content = ''
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

        const splitDocs = await textSplitter.splitText(content)

        logVerbose('Checking page for answer...' + item.link)
        const possibleAnswers = await Promise.all(
          splitDocs.map(async (doc, index) => {
            console.log('Checking doc for link', item.link, `chunck: ${index + 1}/${splitDocs.length}`)
            return await answerQuestionFromQueryPrompt.pipe(llm).pipe(answerParser).invoke({
              output_instructions: answerParser.getFormatInstructions(),
              question,
              content: doc,
              query,
            })
          })
        )
        const highestQualityAnswer = possibleAnswers.reduce((prev, current) => {
          return prev.answerQuality > current.answerQuality ? prev : current
        }, possibleAnswers[0])
        answers.push({ ...highestQualityAnswer, link: item.link, presumedQuestion: question, query })
      } catch (e) {
        console.warn('Error processing page: ' + item.link, e.message)
      }
    })
  )
  const finalOutputStructure = StructuredOutputParser.fromZodSchema(resultSchema)
  const finalAnswer = await finalAnswerPrompt
    .pipe(llm)
    .pipe(finalOutputStructure)
    .invoke({
      query,
      question,
      answers: answers.map((answer) => JSON.stringify(answer)).join('\n\n'),
      output_instructions: finalOutputStructure.getFormatInstructions(),
    })
  return {
    finalAnswer,
    answers,
  }
}
