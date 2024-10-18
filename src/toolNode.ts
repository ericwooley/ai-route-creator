import { ToolNode } from '@langchain/langgraph/prebuilt'
// import { TavilySearchResults } from '@langchain/community/tools/tavily_search'
import { createSearchTool } from './tools/searchTool'
import { z } from 'zod'
import { stepStructure } from './responseStructure'
import { createMapsTool } from './tools/mapsTools'
export const agentTools = [
  createMapsTool({
    verbose: true,
    name: 'distance_google_maps_search',
  }),
  createSearchTool({
    name: 'distance_search',
    description:
      'Search for the distance between two locations, better for fictional locations, For real locations use the google maps search',
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
    description:
      'Search for itineraries for a route and locations along a route, make sure to specify if you are looking for fictional locations or real locations.',
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
export const getToolNode = () => new ToolNode(agentTools)


