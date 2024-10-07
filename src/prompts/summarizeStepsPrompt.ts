import { PromptTemplate } from '@langchain/core/prompts'
import { background } from './backgroundPrompt'
import { flattenState } from '../flattenState'
import { llm } from '../llm'
import { stepsStructure } from '../responseStructure'
import { StateAnnotation } from '../StateAnnotation'
import { StructuredOutputParser } from '@langchain/core/output_parsers'
export const summarizeStepsPrompt = PromptTemplate.fromTemplate(
  `
  ${background}
  The chosen route is "{route}". If this is not a good route name, we need to change it.
  The steps for this route are as follows:
  ~~~
  {steps}
  ~~~
  You are a higher paid researcher, who is reviewing the research proposed for a guide for tourists. You need to summarize the route and steps for the tourists.

  Rename steps and the route for conciseness and clarity. The theme will be presented as well as the title and steps.
  Each step should not include anything but the step name: "The Eiffel Tower" or "The Louvre".
  Do not include "start at the Louvre" or any other information in the step name. Just the name of the place.

  The name of the route is "{route}"

 {format_instructions}
  `.trim()
)
const stepParser = StructuredOutputParser.fromZodSchema(stepsStructure)

export const summarizeSteps = async (state: typeof StateAnnotation.State) => {
  const flattenedState = flattenState(state)
  const response = await summarizeStepsPrompt
    .pipe(llm)
    .pipe(stepParser)
    .invoke({ ...flattenedState, format_instructions: stepParser.getFormatInstructions() })
  console.log('summarizing steps...', JSON.stringify(response))
  return {
    steps: response,
  }
}
