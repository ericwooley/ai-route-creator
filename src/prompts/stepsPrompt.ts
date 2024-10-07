import { PromptTemplate } from '@langchain/core/prompts'
import { background } from './backgroundPrompt'
import { agentModel } from '../agentModel'
import { flattenState } from '../flattenState'
import { StateAnnotation } from '../StateAnnotation'

export const stepsPrompt = PromptTemplate.fromTemplate(
  `
${background}

The Route must have a series of steps. Each step must have a name and a distance. The distance must be in Kilometers.

The route must be a journey, and the steps must be in order.

So far you have the following steps, add more steps to complete the route. You need at least 20 steps, so far you have {stepsLength} steps.:
{steps}

`.trim()
)
export const callModelForSteps = async (state: typeof StateAnnotation.State) => {
  console.log('calling model for steps...')
  const response = await stepsPrompt.pipe(agentModel).invoke({ ...flattenState(state) })
  return {
    ...state,
    messages: [response],
  }
}
