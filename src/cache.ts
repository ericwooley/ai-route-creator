import { RedisCache } from '@langchain/community/caches/ioredis'
import { Redis } from 'ioredis'
export const redis = new Redis({
  host: 'localhost',
  port: 6379,
  db: 0,
})
// Initialize Redis cache
export const cache = new RedisCache(redis)
