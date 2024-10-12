import { StateAnnotation } from './StateAnnotation'

export function flattenState(state: typeof StateAnnotation.State) {
  const { ...restState } = state

  return {
    ...restState,
    messages: state.messages.map((message) => `- ${JSON.stringify(message)}`).join('\n\n'),
    itinerary: state.itinerary
      .map(({ startingLocation, endingLocation }) => `${startingLocation} -> ${endingLocation}`)
      .join('\n'),
    stepsLength: state.steps.length,
    steps: state.steps
      .map((step) => `${step.startingLocation} -> ${step.endingLocation} : ${step.distance} km`)
      .join('\n'),
  }
}
