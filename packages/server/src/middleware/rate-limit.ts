import type { Context, Next } from 'hono'
import { getRedis } from '../lib/redis'
import type { AuthUser } from './auth'

const LIMITS: Record<string, number> = {
  free: 20,
  pro: 100,
  team: 500,
}

export async function rateLimitMiddleware(c: Context, next: Next) {
  const user = c.get('user') as AuthUser | undefined
  if (!user) return next()

  const limit = LIMITS[user.plan] ?? 20
  const key = `rate:${user.id}:${Math.floor(Date.now() / 60000)}`

  try {
    const redis = getRedis()
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, 60)

    c.header('X-RateLimit-Limit', String(limit))
    c.header('X-RateLimit-Remaining', String(Math.max(0, limit - count)))

    if (count > limit) {
      return c.json({ error: 'Rate limit exceeded' }, 429)
    }
  } catch {
    // If Redis is down, allow the request through
  }

  return next()
}
