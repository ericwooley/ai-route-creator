import { PromptTemplate } from '@langchain/core/prompts'
import { background } from './backgroundPrompt'
import { flattenState } from '../flattenState'
import { StateAnnotation } from '../StateAnnotation'
import { llm } from '../llm'
import { z } from 'zod'
import { StructuredOutputParser } from '@langchain/core/output_parsers'
import { stepStructure } from '../responseStructure'
const outputSchema = z.object({
  route: z
    .string()
    .describe(
      'The name of the route, which should describe the route and be as terse as possible. EG "The Silk Road" or "San Fran Cisco To New York". No fluffy bullshit like "The Amazing Adventure"'
    ),
  references: z
    .array(z.object({ name: z.string(), link: z.string() }))
    .describe('Links or references used for picking this route'),
  itinerary: z
    .array(stepStructure.describe('Use -1 for the distance, because we have not researched it yet....'))
    .describe('The steps of the route')
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

Make sure to include the ideal starting location as the first step and the ideal ending location as the last step.

Make sure to summarize this in a route someone could follow on foot or car. Steps that are disjointed, or require a flight or boat should be removed.

The order of the steps are important. Each step should be a journey from the previous step, and be in order from closest to the start to furthest from the start.

Ideally the itinerary should have at least 10 steps, however 5 is a minimum.

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
