// Define interfaces for type safety
export interface Theme {
  theme: string
  description: string
  primaryColor: string
  secondaryColor: string
}
export interface RouteDetails {
  name: string
  distance: number
}
interface Itinerary {
  theme: Theme
  route: string
  steps: RouteDetails[]
}
