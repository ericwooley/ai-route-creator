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

Here are the steps we have already found.
{steps}


{next_information}

Find for the distance on foot to the next step, if possible, by car, train or boat otherwise. Make sure any queries include the starting location, the ending location, and that we are specifically looking for a distance either in miles or kilometers.

`.trim()
)
export const searchStep = async (state: typeof StateAnnotation.State) => {
  const lastStep = state.steps.find((step) => step.distance < 0)
  const response = await stepPrompt.pipe(agentModel).invoke({
    ...flattenState(state),
    next_information: lastStep
      ? `Only search for this: we will perform follow up searches later: ${lastStep.endingLocation} -> our next step. There should only be one tool call.`
      : '',
  })
  return {
    messages: [response],
  }
}
