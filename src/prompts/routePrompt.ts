import { PromptTemplate } from '@langchain/core/prompts'
import { background } from './backgroundPrompt'
import { agentModel } from '../agentModel'
import { flattenState } from '../flattenState'
import { StateAnnotation } from '../StateAnnotation'

export const routePrompt = PromptTemplate.fromTemplate(
  `
${background}
Only output the route name, do not add any additional information, and do not add any formatting, such as back ticks.
`.trim()
)
export const callModelForRoute = async (state: typeof StateAnnotation.State) => {
  console.log('calling model for route....')
  const response = await routePrompt.pipe(agentModel).invoke({ ...flattenState(state) })

  return {
    ...state,

    messages: [response],
  }
}
