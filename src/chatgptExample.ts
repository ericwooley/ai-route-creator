import { TavilySearchResults } from '@langchain/community/tools/tavily_search'

import { ChatOpenAI } from '@langchain/openai'
import { MemorySaver, StateGraph, NodeInterrupt } from '@langchain/langgraph'
import { HumanMessage } from '@langchain/core/messages'
import { RedisCache } from '@langchain/community/caches/ioredis'
import { Redis } from 'ioredis'
import { Annotation, MessagesAnnotation } from '@langchain/langgraph'
import { PromptTemplate } from '@langchain/core/prompts'
import { ToolNode } from '@langchain/langgraph/prebuilt'
import { z } from 'zod'
import zodToJsonSchema from 'zod-to-json-schema'
import { StringOutputParser, StructuredOutputParser } from '@langchain/core/output_parsers'

function flattenState(state: typeof StateAnnotation.State) {
  const { theme, ...restState } = state
  return {
    ...restState,
    messages: state.messages.map((message) => `- ${message.content}`).join('\n\n'),
    themeName: theme.name,
    themeDescription: theme.description,
    themePrimaryColor: theme.primaryColor,
    themeSecondaryColor: theme.secondaryColor,
    stepsLength: state.steps.length,
    steps: state.steps.map((step) => `${step.name} - ${step.distance} km`).join('\n'),
  }
}
// Define interfaces for type safety
interface Theme {
  name: string
  description: string
  primaryColor: string
  secondaryColor: string
}

interface RouteDetails {
  name: string
  distance: number
}

interface Itinerary {
  theme: Theme
  route: string
  steps: RouteDetails[]
}

// Initialize Redis cache
const cache = new RedisCache(
  new Redis({
    host: 'localhost',
    port: 6379,
    db: 0,
  })
)

// Define the theme
const theme: Theme = {
  name: 'Winter Wonderland',
  description: 'A snowy landscape...',
  primaryColor: '#0288D1',
  secondaryColor: '#E0F7FA',
}
const StateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  theme: Annotation<Theme>({
    reducer: (state: Theme) => state,
    default: () => theme,
  }), // Add your specific state fields here
  route: Annotation<string>({
    default: () => '',
    reducer: (state: string, action: string) => action,
  }),
  steps: Annotation({
    default: () => [],
    reducer: (state: RouteDetails[], action: RouteDetails[]) => action,
  }),
})

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

const checkpointer = new MemorySaver()
// Define the tools for the agent to use
const agentTools = [new TavilySearchResults({ maxResults: 20, verbose: true })]
const agentModel = new ChatOpenAI({ maxConcurrency: 2, temperature: 0, cache: cache, model: 'gpt-4o-mini' }).bindTools(
  agentTools
)
const llm = new ChatOpenAI({ maxConcurrency: 2, temperature: 0, cache: cache, model: 'gpt-4o-mini' })
const toolNode = new ToolNode(agentTools)
const background = `
You are a researcher who's job is to find the itineraries for famous routes, fiction or non-fiction. With an emphasis on places
people would love to go, but might not know about. We want to find routes based on a specific theme, to give
people a tailored experience to their interests. The theme for this route is {themeName}. {themeDescription}.

For example, if the theme is "Island Jungle", the route could be "The Road to Hana, starting from Laheina".

If the theme is "Dark Fantasy" the route could be "King's landing to the Wall".


Here is all the research so far.
~~~
{messages}
~~~
`
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
