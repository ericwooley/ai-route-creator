import { PromptTemplate } from '@langchain/core/prompts'
import { background } from './backgroundPrompt'
import { flattenState } from '../flattenState'
import { llm } from '../llm'
import { stepStructure } from '../responseStructure'
import { StateAnnotation } from '../StateAnnotation'
import { StructuredOutputParser } from '@langchain/core/output_parsers'
import { z } from 'zod'
export const summarizeStepsPrompt = PromptTemplate.fromTemplate(
  `
  ${background}
  The chosen route is "{route}". If this is not a good route name, we need to change it.
  The steps for this route are as follows, a distance of -1 means that the distance is unknown:

  Itinerary:
  ~~~
  {itinerary}
  ~~~
  Researched Steps:
  ~~~
  {steps}
  ~~~

  {next_information}
  Based on the most recent information, we need to add the next step to the itinerary.
  You need to add the distance of the next step to the itinerary. The distance must be in kilometers.
  If there is not enough information, you can an educated guess for the distance.

 {format_instructions}
  `.trim()
)

export const summarizeSteps = async (state: typeof StateAnnotation.State) => {
  const stepParser = StructuredOutputParser.fromZodSchema(
    z.number().gte(0).describe('The distance of the step in kilometers')
  )
  const lastStep = state.steps[state.steps.length - 1]
  const nextItinerary = state.itinerary.find((s) => {
    if (lastStep) {
      return s.startingLocation === lastStep.endingLocation
    }

    return true
  })
  const flattenedState = flattenState(state)
  console.log(
    'next_information',
    nextItinerary ? `We need to find ${nextItinerary?.startingLocation} -> ${nextItinerary.endingLocation}` : ''
  )
  const response = await summarizeStepsPrompt
    .pipe(llm)
    .pipe(stepParser)
    .invoke({
      ...flattenedState,
      format_instructions: stepParser.getFormatInstructions(),
      next_information: nextItinerary
        ? `We need to find ${nextItinerary?.startingLocation} -> ${nextItinerary.endingLocation}`
        : '',
    })
  const nextStep = {
    startingLocation: nextItinerary?.startingLocation,
    endingLocation: nextItinerary?.endingLocation,
    distance: response,
  }
  console.log('Found step', nextStep)
  return {
    steps: [...state.steps, nextStep],
  }
}
