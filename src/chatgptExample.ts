import { StateGraph } from '@langchain/langgraph'
import { StateAnnotation } from './StateAnnotation'
import { theme } from './theme'
import { toolNode } from './toolNode'
import { checkpointer } from './checkpointer'
import { callModelForRoute } from './prompts/routePrompt'
import { summarize } from './prompts/summarizePrompt'
import { callModelForSteps } from './prompts/stepsPrompt'

function decideNextRoute({ route, messages, steps }: typeof StateAnnotation.State) {
  const lastMessage = messages[messages.length - 1]
  // If the LLM makes a tool call, then we route to the "tools" node
  if (lastMessage?.additional_kwargs.tool_calls) {
    return 'tools'
  }
  if (!route) {
    return 'findRoute'
  }
  const validSteps = steps.filter((step) => step.name && typeof step.distance === 'number')
  if (validSteps.length < 20) {
    return 'findSteps'
  }
  return '__end__'
}
// Setup the graph
const builder = new StateGraph(StateAnnotation)
  .addNode('summarize', summarize)
  .addNode('findSteps', callModelForSteps)

  .addNode('findRoute', callModelForRoute)
  .addNode('tools', toolNode)
  // An edge from find steps to looking for tools
  .addEdge('findSteps', 'tools')
  .addEdge('findRoute', 'tools')
  .addEdge('tools', 'summarize')
  // .addEdge('summarize', 'findRoute')
  // .addEdge('summarize', 'findSteps')
  .addEdge('__start__', 'findRoute') // __start__ is a special name for the entrypoint
  // .addConditionalEdges('findSteps', shouldContinue)
  // .addConditionalEdges('findRoute', shouldContinue)
  .addConditionalEdges('summarize', decideNextRoute)

const graph = builder.compile({ checkpointer })

// Execute the graph
export const executeGraph = async () => {
  const state = { theme }
  const itinerary = await graph.invoke(state, { configurable: { thread_id: '42' } })
  console.log(itinerary)
}
