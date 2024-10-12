import { z } from 'zod'
export const routeStructure = z.string().describe(`
  The name of the route,
  which should describe the route, either by famous name reference or by the steps. EG "The Silk Road" or "San Fran Cisco To New York"`)
export const stepStructure = z
  .object({
    startingLocation: z.string().describe('The starting location of the step'),
    endingLocation: z.string().describe('The ending location of the step'),
    distance: z.number().describe('The distance of the step'),
    credibility: z.object({
      source: z.string().describe('The source of the information'),
      reliability: z.number().min(0).max(10).describe('The reliability of the information, from 0 to 10'),
      guess: z.boolean().describe('Whether this is a guess or came from the research'),
    }),
  })
  .describe('The steps of the route')
export const stepsStructure = z.array(stepStructure).describe('The steps of the route')
export const responseStructure = z.object({
  route: routeStructure,
  steps: stepsStructure,
})
