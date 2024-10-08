import { PromptTemplate } from '@langchain/core/prompts'
import { background } from './backgroundPrompt'
import { flattenState } from '../flattenState'
import { StateAnnotation } from '../StateAnnotation'
import { llm } from '../llm'
import { z } from 'zod'
import { StructuredOutputParser } from '@langchain/core/output_parsers'
const outputSchema = z.object({
  route: z
    .string()
    .describe(
      'The name of the route, which should describe the route, but should make no reference to the theme, and be as terse as possible. EG "The Silk Road" or "San Fran Cisco To New York". No fluffy bullshit like "The Amazing Adventure"'
    ),
  references: z
    .array(z.object({ name: z.string(), link: z.string() }))
    .describe('Links or references used for picking this route'),
  itinerary: z
    .array(
      z
        .string()
        .describe(
          "The start and end of the step of the leg of the route. EG 'San Fran Cisco' -> 'L.A', each leg should start where the last leg ended."
        )
    )
    .min(5)
    .describe('The steps of the route'),
})

export const summaryParser = StructuredOutputParser.fromZodSchema(outputSchema)

export const routePrompt = PromptTemplate.fromTemplate(
  `
${background}
We have been given the ideas for an itinerary. Create a route from these ideas.
The Route Name should clearly indicate where the route starts or where it ends. If it is a well known route, you can use the name of the route.

Example of a popular name that doesn't need to indicate start or end: "The Silk Road" is a popular name that is known by many to be a route from China to Europe. "The Silk Road" is a good name for a route.
Example of a name that needs to indicate start or end: "San Fran Cisco To New York" is a good name for a route that goes from San Francisco to New York. There is no popular name for this route, so it needs to indicate the start and end.

All steps in the itinerary must be places as a noun, and not a collection of places. For example, "The Eiffel Tower" is a good step, but "The Eiffel Tower and the Louvre" is not a good step.
{parser_instructions}

`.trim()
)
export const pickRouteNode = async (state: typeof StateAnnotation.State) => {
  const response = await routePrompt
    .pipe(llm)
    .pipe(summaryParser)
    .invoke({ ...flattenState(state), parser_instructions: summaryParser.getFormatInstructions() })
  return {
    route: response.route,
    references: response.references,
    itinerary: response.itinerary,
  }
}
