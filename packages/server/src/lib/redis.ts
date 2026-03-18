import Redis from 'ioredis'
import { env } from './env'

let redis: Redis | null = null

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 })
  }
  return redis
}
