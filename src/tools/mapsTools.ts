import { z } from 'zod'
import { redis } from '../cache'
import { Client as MapClient, PlaceInputType } from '@googlemaps/google-maps-services-js'

const log =
  (ctx: string, verbose: boolean) =>
  (...args: any[]) =>
    verbose ? console.warn(ctx + ':', ...args) : null

interface MapsResult {
  results: Array<{
    formatted_address: string
    geometry: {
      location: {
        lat: number
        lng: number
      }
    }
    name: string
    place_id: string
  }>
  status: string
}
const apiKey = process.env.GOOGLE_MAPS_API_KEY ?? ''
if (!apiKey) {
  throw new Error('No Google Maps API key found')
}
// Initialize the Google Maps Client
const mapClient = new MapClient({})
async function findPlaceFromText({ input, key }: { input: string; key: string }) {
  try {
    return await mapClient.findPlaceFromText({
      params: {
        input,
        inputtype: PlaceInputType.textQuery,
        key: apiKey,
      },
    })
  } catch (e) {
    console.error('error searching for place: input', e)
    return null
  }
}
export async function searchGoogleMaps({ from, to, verbose }: { from: string; to: string; verbose: boolean }) {
  const logVerbose = log(from, verbose)

  if (!apiKey) {
    console.error('Google Maps API key is missing')
    return null
  }

  const [fromPlace, toPlace] = await Promise.all([
    findPlaceFromText({ input: from, key: apiKey }),
    findPlaceFromText({ input: to, key: apiKey }),
  ])
  if (!fromPlace || !toPlace) {
    return null
  }
  logVerbose('From:', fromPlace.data.candidates[0])
  logVerbose('To:', toPlace.data.candidates[0])
  const fromId = fromPlace.data.candidates[0].place_id
  if (!fromId) {
    logVerbose('No place id found for:', from)
    return null
  }
  const toId = toPlace.data.candidates[0].place_id
  if (!toId) {
    logVerbose('No place id found for:', to)
    return null
  }

  const distance = await mapClient.distancematrix({
    params: {
      origins: ['place_id:' + fromId],
      destinations: ['place_id:' + toId],
      key: apiKey,
    },
  })
  logVerbose('Distance:', distance.data, distance)
  return distance.data
}

export const createMapsTool = ({
  verbose,
  name = 'google maps search',
  description = 'Searches Google Maps and returns location results. This should only be used for non-fictional locations. Real places on earth during modern times only.',
}: {
  name?: string
  description?: string
  verbose: boolean
}) => ({
  name,
  description,
  schema: z.object({
    from: z.string().min(5).describe('The Starting location'),
    to: z.string().min(5).describe('The Destination location'),
  }),

  func: async ({ from, to }: { from: string; to: string }) => {
    const logVerbose = log(from, verbose)
    logVerbose('Searching for:', from)
    const cacheKey = name + `:maps-search-${from}`
    const cachedResponse = await redis.get(cacheKey)
    if (cachedResponse) {
      const finalResult = JSON.parse(cachedResponse)
      logVerbose('Using cached response:', JSON.stringify(finalResult, null, 2))
      return { query: from, ...finalResult }
    }
    logVerbose('Searching for:', from)
    const results = await searchGoogleMaps({ from, to, verbose })
    if (!results) {
      return null
    }
    logVerbose('Results:', results)
    // await redis.set(cacheKey, JSON.stringify(results), 'EX', 60 * 60 * 24 * 7)
    return { query: from, results }
  },
})
