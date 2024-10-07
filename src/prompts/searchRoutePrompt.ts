import { PromptTemplate } from '@langchain/core/prompts'
import { background } from './backgroundPrompt'
import { flattenState as llmState } from '../flattenState'
import { StateAnnotation } from '../StateAnnotation'
import { agentModel } from '../agentModel'

export const routePrompt = PromptTemplate.fromTemplate(
  `
${background}
You must determine the route that fits this theme. Use the theme name and colors to perform a search,
which will give you a list of routes to pick from. After the search, you will pick a route name from the results.

Do no simply search the theme name. Create a search query to search for places or things that are related to the theme.

You should come up with these ideas. Use your knowledge of geography, history and works of fiction to come up with search ideas related to this theme.

For example if the theme is "Jungle Adventure" you could search for "Tourist destinations in the Amazon Rainforest".

If the theme is "Dark Fantasy" you could search for "Most popular routes in dark fantasy books.".

No words from the theme itself should appear in your query.

{routeIdea}

{fictional}

`.trim()
)
export const searchRouteNode = async (state: typeof StateAnnotation.State) => {
  const response = await routePrompt.pipe(agentModel).invoke({
    ...llmState(state),
  })
  return {
    messages: [response],
  }
}
