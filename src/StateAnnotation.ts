import { Annotation, MessagesAnnotation } from '@langchain/langgraph'
import { Theme, RouteDetails } from './types'
import { theme } from './theme'

export const StateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  itinerary: Annotation<string[]>({
    default: () => [],
    reducer: (state: string[], action: string[]) => [...state, ...action],
  }),
  theme: Annotation<Theme>({
    reducer: (state: Theme) => state,
    default: () => theme,
  }), // Add your specific state fields here
  route: Annotation<string>({
    default: () => '',
    reducer: (state: string, action: string) => action,
  }),
  steps: Annotation({
    default: () => [],
    reducer: (state: RouteDetails[], action: RouteDetails[]) => action,
  }),
})
