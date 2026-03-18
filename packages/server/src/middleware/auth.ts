import type { Context, Next } from 'hono'
import { verifyToken, findUserById } from '../services/auth.service'

export type AuthUser = {
  id: string
  email: string
  name: string
  plan: string
}

export async function authMiddleware(c: Context, next: Next) {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401)
  }

  const token = header.slice(7)
  const userId = await verifyToken(token)
  if (!userId) {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }

  const user = await findUserById(userId)
  if (!user) {
    return c.json({ error: 'User not found' }, 401)
  }

  c.set('user', {
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
  })
  await next()
}
