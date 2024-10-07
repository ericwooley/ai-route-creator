import { StructuredOutputParser } from '@langchain/core/output_parsers'
import { z } from 'zod'
export const responseStructure = z.object({
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
export const summaryParser = StructuredOutputParser.fromZodSchema(responseStructure)
