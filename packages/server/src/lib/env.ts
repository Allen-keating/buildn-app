function required(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing required env var: ${key}`)
  return value
}

export const env = {
  get DATABASE_URL() {
    return required('DATABASE_URL')
  },
  get JWT_SECRET() {
    return required('JWT_SECRET')
  },
  get REDIS_URL() {
    return process.env.REDIS_URL ?? 'redis://localhost:6379'
  },
  get PORT() {
    return Number(process.env.PORT) || 3001
  },
} as const
