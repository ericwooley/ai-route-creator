import { StructuredOutputParser } from '@langchain/core/output_parsers'
import { z } from 'zod'
export const routeStructure = z.string().describe(`
  The name of the route, which should make no reference to the theme,
  and should describe the route, either by famous name reference or by the steps. EG "The Silk Road" or "San Fran Cisco To New York"`)
export const stepsStructure = z.array(
  z
    .object({
      name: z.string().describe('The name of the step'),
      distance: z.number().describe('The distance of the step in kilometers'),
    })
    .describe('The steps of the route')
)
export const responseStructure = z.object({
  route: routeStructure,
  steps: stepsStructure,
})
