import { StateAnnotation } from './StateAnnotation'

export function flattenState(state: typeof StateAnnotation.State) {
  const { theme, ...restState } = state
  return {
    ...restState,
    messages: state.messages.map((message) => `- ${message.content}`).join('\n\n'),
    themeName: theme.name,
    themeDescription: theme.description,
    themePrimaryColor: theme.primaryColor,
    themeSecondaryColor: theme.secondaryColor,
    stepsLength: state.steps.length,
    steps: state.steps.map((step) => `${step.name} - ${step.distance} km`).join('\n'),
  }
}