import { StateGraph } from '@langchain/langgraph'
import { StateAnnotation } from './StateAnnotation'
import { toolNode } from './toolNode'
import { checkpointer } from './checkpointer'
import { searchRouteNode } from './prompts/searchRoutePrompt'
import { summarizeSteps } from './prompts/summarizeStepsPrompt'
import { searchStep } from './prompts/searchStepPrompt'
import { pickRouteNode } from './prompts/pickRoutePrompt'
import { searchItineraryNode } from './prompts/searchItineraryPrompt'

function decideNextRoute({ messages, steps, itinerary }: typeof StateAnnotation.State) {
  const lastMessage = messages[messages.length - 1]
  // If the LLM makes a tool call, then we route to the "tools" node
  if (lastMessage?.additional_kwargs.tool_calls) {
    return 'searchForStepDistancesTool'
  }
  if (itinerary.length < 1) {
    return 'pickRoute'
  }
  const validSteps = steps.filter(
    (step) => step.startingLocation && step.endingLocation && typeof step.distance === 'number'
  )
  console.log('validSteps', steps, validSteps.length, 'itinerary', itinerary.length)
  if (validSteps.length < itinerary.length) {
    return 'findStep'
  }
  return '__end__'
}

// Setup the graph
const builder = new StateGraph(StateAnnotation)
  .addNode('summarize', summarizeSteps)
  .addNode('findStep', searchStep)
  .addNode('routeSearch', searchRouteNode)
  .addNode('pickRoute', pickRouteNode)
  .addNode('searchForItineraryTools', toolNode)
  .addNode('itinerarySearcher', searchItineraryNode)
  .addNode('searchForStepDistancesTool', toolNode)
  .addNode('searchForRouteTool', toolNode)
  .addEdge('__start__', 'routeSearch')
  .addEdge('routeSearch', 'searchForRouteTool')
  .addEdge('itinerarySearcher', 'searchForItineraryTools')
  .addEdge('searchForItineraryTools', 'findStep')
  .addEdge('searchForRouteTool', 'pickRoute')
  .addEdge('findStep', 'searchForStepDistancesTool')
  .addEdge('pickRoute', 'itinerarySearcher')
  .addEdge('searchForStepDistancesTool', 'summarize')
  .addConditionalEdges('summarize', decideNextRoute)

const graph = builder.compile({ checkpointer })

// Execute the graph
export const generateRoute = async ({ routeIdea, fictional }: { routeIdea?: string; fictional?: boolean } = {}) => {
  console.log('Generating route', routeIdea, fictional)
  const state = { routeIdea, fictional }
  const itinerary = await graph.invoke(state, { configurable: { thread_id: '42' }, recursionLimit: 40 })
  console.log(itinerary)
  console.log('Thanks for using the chatgptExample')
  process.exit(0)
}
