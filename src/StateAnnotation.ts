import { Annotation, MessagesAnnotation } from '@langchain/langgraph'
import { Theme, RouteDetails } from './types'
import { theme } from './theme'
import _ from 'lodash'

export const StateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  fictional: Annotation<boolean>({
    default: () => false,
    reducer: (state: boolean, action: boolean) => action,
  }),
  routeIdea: Annotation<string>({
    default: () => '',
    reducer: (state: string, action: string) => action,
  }),
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
    reducer: (state: RouteDetails[], action: RouteDetails[]) => _.uniqBy([...state, ...action], 'name'),
  }),
})
