import { PromptTemplate } from '@langchain/core/prompts'
import { background } from './backgroundPrompt'
import { flattenState as llmState } from '../flattenState'
import { StateAnnotation } from '../StateAnnotation'
import { agentModel } from '../agentModel'

export const routePrompt = PromptTemplate.fromTemplate(
  `
${background}

If we already have a route idea, we are going to search for more information on that.
If we do not have a route idea we must determine the route that fits this theme.
Which will give you a list of routes to pick from.
After the search, you will pick a route name from the results.

If the route idea already exists which is already a route, just search for more information about that route.

For example: "Locations on the silk road.", it is ok to use the route idea directly in the query.
`.trim()
)
export const searchRouteNode = async (state: typeof StateAnnotation.State) => {
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
