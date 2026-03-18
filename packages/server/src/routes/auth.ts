import { Hono } from 'hono'
import type { AppEnv } from '../types'
import {
  hashPassword,
  verifyPassword,
  signToken,
  findUserByEmail,
  createUser,
  findUserById,
} from '../services/auth.service'
import { authMiddleware, type AuthUser } from '../middleware/auth'

const auth = new Hono<AppEnv>()

auth.post('/register', async (c) => {
  const { email, password, name } = await c.req.json<{
    email: string
    password: string
    name: string
  }>()

  if (!email || !password || !name) {
    return c.json({ error: 'email, password, and name are required' }, 400)
  }

  const existing = await findUserByEmail(email)
  if (existing) {
    return c.json({ error: 'Email already registered' }, 409)
  }

  const passwordHash = await hashPassword(password)
  const user = await createUser(email, name, passwordHash)
  const token = await signToken(user.id)

  return c.json(
    {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        createdAt: user.createdAt,
      },
      token,
    },
    201,
  )
})

auth.post('/login', async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>()

  const user = await findUserByEmail(email)
  if (!user || !user.passwordHash) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  const token = await signToken(user.id)
  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      createdAt: user.createdAt,
    },
    token,
  })
})

auth.get('/me', authMiddleware, async (c) => {
  const authUser = c.get('user')
  const user = await findUserById(authUser.id)
  if (!user) return c.json({ error: 'User not found' }, 404)

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      createdAt: user.createdAt,
    },
  })
})

export { auth }
