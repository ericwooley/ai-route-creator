import { StateGraph } from '@langchain/langgraph'
import { StateAnnotation } from './StateAnnotation'
import themes from './themes.json'
import { toolNode } from './toolNode'
import { checkpointer } from './checkpointer'
import { searchRouteNode } from './prompts/searchRoutePrompt'
import { summarizeSteps } from './prompts/summarizeStepsPrompt'
import { findStep } from './prompts/findStepPrompt'
import { pickRouteNode } from './prompts/pickRoutePrompt'

function decideNextRoute({ messages, steps, itinerary }: typeof StateAnnotation.State) {
  const lastMessage = messages[messages.length - 1]
  // If the LLM makes a tool call, then we route to the "tools" node
  if (lastMessage?.additional_kwargs.tool_calls) {
    return 'searchForStepDistancesTool'
  }
  if (itinerary.length < 1) {
    return 'pickRoute'
  }
  const validSteps = steps.filter((step) => step.name && typeof step.distance === 'number')
  console.log('validSteps', steps, validSteps.length, 'itinerary', itinerary.length)
  if (validSteps.length < itinerary.length) {
    return 'findStep'
  }
  return '__end__'
}

// Setup the graph
const builder = new StateGraph(StateAnnotation)
  /**
   * Summarize the route and steps based on the messages.
   */
  .addNode('summarize', summarizeSteps)
  /**
   * Find the steps for the given route.
   */
  .addNode('findStep', findStep)
  /**
   * Search for the route based on the theme.
   */
  .addNode('routeSearch', searchRouteNode)
  /**
   * Pick the route based on the search results.
   */
  .addNode('pickRoute', pickRouteNode)
  /**
   * Tools node to call the tools
   */
  .addNode('searchForStepDistancesTool', toolNode)
  /**
   * Duplicate tools node that should only edge back to picking the route.
   */
  .addNode('searchForRouteTool', toolNode)
  .addEdge('__start__', 'routeSearch')
  .addEdge('routeSearch', 'searchForRouteTool')
  .addEdge('searchForRouteTool', 'pickRoute')
  .addEdge('findStep', 'searchForStepDistancesTool')
  .addEdge('pickRoute', 'findStep')
  .addEdge('searchForStepDistancesTool', 'summarize')
  .addConditionalEdges('summarize', decideNextRoute)

const graph = builder.compile({ checkpointer })

// Execute the graph
export const generateRoute = async ({
  routeIdea,
  fictional,
  theme: themeName,
}: { routeIdea?: string; fictional?: boolean; theme?: string } = {}) => {
  console.log('Generating route', routeIdea, fictional, themeName)
  const theme = themes.find(({ theme: name }) => name === themeName)
  if (!theme) {
    console.error('Invalid theme')
    process.exit(1)
  }
  const state = { theme, routeIdea, fictional }
  const itinerary = await graph.invoke(state, { configurable: { thread_id: '42' }, recursionLimit: 40 })
  console.log(itinerary)
  console.log('Thanks for using the chatgptExample')
  process.exit(0)
}
