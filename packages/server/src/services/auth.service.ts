import { eq } from 'drizzle-orm'
import bcrypt from 'bcrypt'
import { SignJWT, jwtVerify } from 'jose'
import { db } from '../db'
import { users } from '../db/schema'
import { env } from '../lib/env'

const secret = () => new TextEncoder().encode(env.JWT_SECRET)

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function signToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret())
}

export async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    return payload.sub ?? null
  } catch {
    return null
  }
}

export async function findUserByEmail(email: string) {
  return db.query.users.findFirst({ where: eq(users.email, email) })
}

export async function findUserById(id: string) {
  return db.query.users.findFirst({ where: eq(users.id, id) })
}

export async function createUser(email: string, name: string, passwordHash: string) {
  const [user] = await db.insert(users).values({ email, name, passwordHash }).returning()
  return user
}
