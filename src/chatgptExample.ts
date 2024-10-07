import { StateGraph } from '@langchain/langgraph'
import { PromptTemplate } from '@langchain/core/prompts'
import { z } from 'zod'
import { StructuredOutputParser } from '@langchain/core/output_parsers'
import { flattenState } from './flattenState'
import { StateAnnotation } from './StateAnnotation'
import { theme } from './theme'
import { agentModel } from './agentModel'
import { llm } from './llm'
import { toolNode } from './toolNode'
import { background } from './background'
import { checkpointer } from './checkpointer'

const responseStructure = z.object({
  route: z.string().describe('The name of the route'),
  steps: z.array(
    z
      .object({
        name: z.string().describe('The name of the step'),
        distance: z.number().describe('The distance of the step in kilometers'),
      })
      .describe('The steps of the route')
  ),
})

const routePrompt = PromptTemplate.fromTemplate(
  `
${background}
Only output the route name, do not add any additional information, and do not add any formatting, such as back ticks.
`.trim()
)

const stepsPrompt = PromptTemplate.fromTemplate(
  `
${background}

The Route must have a series of steps. Each step must have a name and a distance. The distance must be in Kilometers.

The route must be a journey, and the steps must be in order.

So far you have the following steps, add more steps to complete the route. You need at least 20 steps, so far you have {stepsLength} steps.:
{steps}

`.trim()
)

const summaryParser = StructuredOutputParser.fromZodSchema(responseStructure)
const summarizePrompt = PromptTemplate.fromTemplate(
  `
  ${background}
  The chosen route is "{route}". If this is not a good route name, we need to change it.
  The steps for this route are as follows:
  ~~~
  {steps}
  ~~~
  You are a higher paid researcher, who is reviewing the research proposed for a guide for tourists. You need to summarize the route and steps for the tourists.
 {format_instructions}
  `.trim()
)
const callModelForSteps = async (state: typeof StateAnnotation.State) => {
  console.log('calling model for steps...')
  const response = await stepsPrompt.pipe(agentModel).invoke({ ...flattenState(state) })
  return {
    ...state,
    messages: [response],
  }
}
const callModelForRoute = async (state: typeof StateAnnotation.State) => {
  console.log('calling model for route....')
  const response = await routePrompt.pipe(agentModel).invoke({ ...flattenState(state) })

  return {
    ...state,

    messages: [response],
  }
}

const summarize = async (state: typeof StateAnnotation.State) => {
  const partialedPrompt = await summarizePrompt.partial({
    format_instructions: summaryParser.getFormatInstructions(),
  })
  const flattenedState = flattenState(state)
  console.log(
    'summarizing...',
    JSON.stringify({
      route: state.route,
      steps: state.steps,
    })
  )
  const response = await partialedPrompt
    .pipe(llm)
    .pipe(summaryParser)
    .invoke({ ...flattenedState })

  return {
    route: response.route,
    steps: response.steps,
    messages: state.messages,
  }
}

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
  console.log(
    JSON.stringify(
      {
        route,
        steps,
        messages,
      },
      null,
      2
    )
  )
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
