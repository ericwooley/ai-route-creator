import { RedisCache } from '@langchain/community/caches/ioredis'
import { Redis } from 'ioredis'
// Initialize Redis cache
export const cache = new RedisCache(
  new Redis({
    host: 'localhost',
    port: 6379,
    db: 0,
  })
)
