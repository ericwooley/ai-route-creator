import { StateAnnotation } from './StateAnnotation'

export function flattenState(state: typeof StateAnnotation.State) {
  const { ...restState } = state
  const firstAndLast10Messages = state.messages.slice(0, 5).concat(state.messages.slice(-5))
  return {
    ...restState,
    messages: firstAndLast10Messages.map((message) => `- ${JSON.stringify(message.content)}`).join('\n\n'),
    itinerary: state.itinerary
      .map(
        ({ startingLocation, endingLocation, ...otherInfo }) =>
          `${startingLocation} -> ${endingLocation}: ${JSON.stringify(otherInfo)}`
      )
      .join('\n'),
    stepsLength: state.steps.length,
    steps: state.steps
      .map((step) => `${step.startingLocation} -> ${step.endingLocation} : ${step.distance} km`)
      .join('\n'),
  }
}
