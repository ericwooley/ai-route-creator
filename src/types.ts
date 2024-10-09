// Define interfaces for type safety
export interface Theme {
  theme: string
  description: string
  primaryColor: string
  secondaryColor: string
}
export interface RouteDetails {
  startingLocation: string
  endingLocation: string
  distance: number
}
interface Itinerary {
  theme: Theme
  route: string
  steps: RouteDetails[]
}
