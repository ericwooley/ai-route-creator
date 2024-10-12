import { ToolNode } from '@langchain/langgraph/prebuilt'
// import { TavilySearchResults } from '@langchain/community/tools/tavily_search'
import { createSearchTool } from './tools/searchTool'
import { z } from 'zod'
import { stepStructure } from './responseStructure'
export const agentTools = [
  createSearchTool({
    name: 'distance_search',
    description: 'Search for the distance between two locations',
    responseSchema: z.object({
      distance: z.number().describe('The distance in miles or kilometers'),
      unit: z.union([
        z.literal('km').describe('use this for kilometers'),
        z.literal('mi').describe('use this for miles'),
      ]),
    }),
    transform: (answer) => {
      if (answer.unit === 'mi') {
        return {
          distance: answer.distance * 1.60934,
          unit: 'km',
        }
      }
      return answer
    },
    verbose: true,
  }),
  createSearchTool({
    name: 'popular_route_search',
    description: 'Search for routes which people might like to travel',
    responseSchema: z.array(
      z.object({
        routeName: z
          .string()
          .describe(
            'The name of the route which and should describe the route, either by famous name reference or by the steps. EG "The Silk Road" or "San Fran Cisco To New York"'
          ),
      })
    ),
    verbose: true,
  }),
  createSearchTool({
    name: 'itinerary_search',
    description: 'Search for itineraries for a route and locations along a route',
    responseSchema: z.array(
      z.array(
        stepStructure
          .omit({
            distance: true,
          })
          .extend({
            description: z.string().describe('A description of this leg of the route, and things to look for.'),
          })
          .describe('The steps of the itinerary')
      )
    ),
    verbose: true,
  }),
  // new TavilySearchResults({ maxResults: 20, verbose: true })
]
export const toolNode = new ToolNode(agentTools)


