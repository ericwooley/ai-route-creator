import { Annotation, MessagesAnnotation } from '@langchain/langgraph'
import { RouteDetails } from './types'
import _ from 'lodash'

export const StateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  fictional: Annotation<boolean>({
    default: () => false,
    reducer: (state: boolean, action: boolean) => action,
  }),
  references: Annotation<
    {
      name: string
      link: string
    }[]
  >({
    default: () => [],
    reducer: (state, action) => action,
  }),
  routeIdea: Annotation<string>({
    default: () => '',
    reducer: (state: string, action: string) => action,
  }),
  itinerary: Annotation<RouteDetails[]>({
    default: () => [],
    reducer: (state: RouteDetails[], action: RouteDetails[]) => action,
  }),
  route: Annotation<string>({
    default: () => '',
    reducer: (state: string, action: string) => action,
  }),
  steps: Annotation({
    default: () => [],
    reducer: (state: RouteDetails[], action: RouteDetails[]) => action,
  }),
})
