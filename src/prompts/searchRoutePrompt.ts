import { PromptTemplate } from '@langchain/core/prompts'
import { background } from './backgroundPrompt'
import { flattenState as llmState } from '../flattenState'
import { StateAnnotation } from '../StateAnnotation'
import { getAgentModel } from '../agentModel'

export const routePrompt = PromptTemplate.fromTemplate(
  `
${background}

If we already have a route idea, we need to search the internet to refine that idea into a single route, which users could follow.
This will give you a list of routes to pick from and possible locations on those routes.

Make sure your search includes whether we are looking for fictional places or real places. We don't want real-life locations mixed with fictional locations used for filming, etc.
If the user is looking for fiction, make sure to include that in the search.

For example: if the idea is non fiction "Historical adventure" the search might be "Interesting routes for a historical adventure"
if the the idea is fiction "Historical Adventure" the search might be "Interesting routes ideas for a historical adventure based on fictional locations."

`.trim()
)
export const searchRouteNode = async (state: typeof StateAnnotation.State) => {
  const response = await routePrompt.pipe(getAgentModel()).invoke({
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
