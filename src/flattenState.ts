import { StateAnnotation } from './StateAnnotation'

export function flattenState(state: typeof StateAnnotation.State) {
  const { theme, ...restState } = state

  return {
    ...restState,
    messages: state.messages.map((message) => `- ${JSON.stringify(message)}`).join('\n\n'),
    itinerary: state.itinerary
      .map(({ startingLocation, endingLocation }) => `${startingLocation} -> ${endingLocation}`)
      .join('\n'),
    themeName: theme.theme,
    themeDescription: theme.description,
    themePrimaryColor: theme.primaryColor,
    themeSecondaryColor: theme.secondaryColor,
    stepsLength: state.steps.length,
    steps: state.steps
      .map((step) => `${step.startingLocation} -> ${step.endingLocation} : ${step.distance} km`)
      .join('\n'),
  }
}
