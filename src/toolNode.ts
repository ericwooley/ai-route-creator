import { ToolNode } from '@langchain/langgraph/prebuilt'
// import { TavilySearchResults } from '@langchain/community/tools/tavily_search'
import { createSearchTool } from './tools/searchTool'
import { z } from 'zod'
export const agentTools = [
  createSearchTool({
    name: 'distance_search',
    description: 'Search for the distance between two locations in Kilometers',
    responseSchema: z.number().describe('The distance in Kilometers'),
    verbose: true,
  }),
  createSearchTool({
    name: 'popular_route_search',
    description: 'Search for routes which people might like to travel',
    responseSchema: z.array(z.object({
      routeName: z.string().describe('The name of the route, which should make no reference to the theme, and should describe the route, either by famous name reference or by the steps. EG "The Silk Road" or "San Fran Cisco To New York"'),
    })),
    verbose: true,
  }),
  // new TavilySearchResults({ maxResults: 20, verbose: true })
]
export const toolNode = new ToolNode(agentTools)


