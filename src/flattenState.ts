import { StateAnnotation } from './StateAnnotation'

export function flattenState(state: typeof StateAnnotation.State) {
  const { theme, ...restState } = state
  return {
    ...restState,
    routeIdea: state.routeIdea
      ? `
          The users have requested this idea for the route specifically. Please use this idea to search for a route.

          ${state.routeIdea}

      `.trim()
      : '',
    fictional: state.fictional
      ? `
     The Route is fictional. Only use fictional options for your search.
    `
      : '',
    messages: state.messages.map((message) => `- ${message.content}`).join('\n\n'),
    itinerary: state.itinerary.join('\n'),
    themeName: theme.name,
    themeDescription: theme.description,
    themePrimaryColor: theme.primaryColor,
    themeSecondaryColor: theme.secondaryColor,
    stepsLength: state.steps.length,
    steps: state.steps.map((step) => `${step.name} - ${step.distance} km`).join('\n'),
  }
}
