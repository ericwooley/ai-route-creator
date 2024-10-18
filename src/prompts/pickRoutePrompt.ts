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
  itinerary: z.array(
    stepStructure
      .omit({
        credibility: true,
        distance: true,
      })
      .extend({
        fictionalLocation: z.boolean().describe('Whether the location is fictional or real'),
        possibleAddressInfo: z.array(z.string()).describe('Possible addresses for the location'),
        anyExtraInformationOnHowToFind: z.string().describe('Any extra information on how to find the location'),
      })
      .describe('Use -1 for the distance, because we have not researched it yet....')
  ),
  // .describe('The steps of the route, this should be a minimum of 5 steps, 10 is better, 20+ is fantastic'),
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

The itinerary should have at least 10 steps, however 5 is a minimum if there simply is not enough for 10. 20 or more is fantastic.

Make sure to include the final destination as the last step. We don't just want destinations, we want a route, with a start and end.

Make sure all locations in the itinerary make sense for the proposed route based on the search results. You cannot trust the idea submitter to have done this correctly. Use the search results to make sure itinerary ideas make sense.

Part of your job is removing results that don't fit. For example, if the user is searching a fictional route, and the search results include a real location, you should remove that location from the itinerary.

{parser_instructions}

`.trim()
)
export const pickRouteNode = async (state: typeof StateAnnotation.State) => {
  const response = await routePrompt
    .pipe(llm())
    .pipe(summaryParser)
    .invoke({ ...flattenState(state), parser_instructions: summaryParser.getFormatInstructions() })
  console.log('Found route', response)
  return {
    route: response.route,
    references: response.references,
    itinerary: response.itinerary,
  }
}
