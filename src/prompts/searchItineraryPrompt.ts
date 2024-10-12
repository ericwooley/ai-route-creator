import { PromptTemplate } from '@langchain/core/prompts'
import { background } from './backgroundPrompt'
import { flattenState as llmState } from '../flattenState'
import { StateAnnotation } from '../StateAnnotation'
import { agentModel } from '../agentModel'

export const routePrompt = PromptTemplate.fromTemplate(
  `
${background}
Search for more information about our route. EG: "Most interesting places to stop while traveling on the silk road".

Make sure your search includes whether we are looking for fictional places or real places. We don't want real-life locations mixed with fictional locations used for filming, etc.
If the user is looking for fiction, make sure to include that in the search.

For example: If the route is "kings landing to the wall" search for "Where would you stop on a journey from kings landing to the wall".
It is ok to use the route idea directly in the query, but that should not be the entire query. Make sure to add context to the query to get the best results, we are looking for pages that will describe the route.

We are looking for a route that is a journey which can be taken in the car or on foot, and the steps must be in order, it's very important.

`.trim()
)
export const searchItineraryNode = async (state: typeof StateAnnotation.State) => {
  const response = await routePrompt.pipe(agentModel).invoke({
    ...llmState(state),
  })
  if (response.content.toString().toLowerCase().includes(state.routeIdea.toLowerCase())) {
    return {
      route: state.routeIdea,
    }
  }
  return {
    messages: [response],
  }
}
