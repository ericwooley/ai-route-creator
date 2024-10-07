import { PromptTemplate } from '@langchain/core/prompts'
import { background } from './backgroundPrompt'
import { agentModel } from '../agentModel'
import { flattenState } from '../flattenState'
import { StateAnnotation } from '../StateAnnotation'

export const stepPrompt = PromptTemplate.fromTemplate(
  `
${background}

The Route must have a series of steps. Each step must have a name and a distance. The distance must be in Kilometers.

The route must be a journey, and the steps must be in order.

This is your itinerary for the route "{route}"

here is the itinerary:
{itinerary}

So far you have the following steps, add more steps to complete the route. You need at least 5 steps, so far you have {stepsLength} steps:
{steps}

Find for the distance on foot to the next step, if possible, by car, train or boat otherwise. The distance must be in kilometers.

`.trim()
)
export const findStep = async (state: typeof StateAnnotation.State) => {
  const response = await stepPrompt.pipe(agentModel).invoke({ ...flattenState(state) })
  return {
    messages: [response],
  }
}
