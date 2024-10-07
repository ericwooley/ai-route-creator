import { PromptTemplate } from '@langchain/core/prompts'
import { background } from './backgroundPrompt'
import { flattenState } from '../flattenState'
import { llm } from '../llm'
import { summaryParser } from '../responseStructure'
import { StateAnnotation } from '../StateAnnotation'

export const summarizePrompt = PromptTemplate.fromTemplate(
  `
  ${background}
  The chosen route is "{route}". If this is not a good route name, we need to change it.
  The steps for this route are as follows:
  ~~~
  {steps}
  ~~~
  You are a higher paid researcher, who is reviewing the research proposed for a guide for tourists. You need to summarize the route and steps for the tourists.
 {format_instructions}
  `.trim()
)
export const summarize = async (state: typeof StateAnnotation.State) => {
  const partialedPrompt = await summarizePrompt.partial({
    format_instructions: summaryParser.getFormatInstructions(),
  })
  const flattenedState = flattenState(state)
  console.log(
    'summarizing...',
    JSON.stringify({
      route: state.route,
      steps: state.steps,
    })
  )
  const response = await partialedPrompt
    .pipe(llm)
    .pipe(summaryParser)
    .invoke({ ...flattenedState })

  return {
    route: response.route,
    steps: response.steps,
    messages: state.messages,
  }
}
