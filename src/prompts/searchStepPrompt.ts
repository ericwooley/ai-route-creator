import { PromptTemplate } from '@langchain/core/prompts'
import { background } from './backgroundPrompt'
import { agentModel } from '../agentModel'
import { flattenState } from '../flattenState'
import { StateAnnotation } from '../StateAnnotation'

export const stepPrompt = PromptTemplate.fromTemplate(
  `
${background}

The Route must have a series of steps. Each step must have a name and a distance.

The route must be a journey, and the steps must be in order.

This is your itinerary for the route "{route}"

here is the itinerary:
{itinerary}

Here are the steps we have already found.
{steps}

{next_information}

Use the tools available to you to search for information about the next step in the route.

If fictional, make sure to include the distance in the search query.

Do not make a guess, use the tools to search or get the distance from google maps.

Prefer maps tools if the locations are real and on planet earth.

`.trim()
)
export const searchStep = async (state: typeof StateAnnotation.State) => {
  const lastStep = state.steps[state.steps.length - 1]
  const nextItinerary =
    state.itinerary.find((i) => i.startingLocation === lastStep?.endingLocation) || state.itinerary[0]
  let nextInfo = nextItinerary
    ? `Only search for this, we will perform follow up searches later: ${nextItinerary.startingLocation} -> our next step. There should only be one tool call.`
    : ''
  if (!nextInfo) {
    console.warn('No next information found')
  }
  const response = await stepPrompt.pipe(agentModel).invoke({
    ...flattenState(state),
    next_information: nextInfo,
  })
  return {
    messages: [response],
  }
}
