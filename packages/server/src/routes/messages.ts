import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { eq, desc } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth'
import { getProject } from '../services/project.service'
import { db } from '../db'
import { messages } from '../db/schema'

const messageRoutes = new Hono<AppEnv>()

messageRoutes.use('*', authMiddleware)

messageRoutes.get('/:id/messages', async (c) => {
  const user = c.get('user')
  const project = await getProject(c.req.param('id'), user.id)
  if (!project) return c.json({ error: 'Project not found' }, 404)

  const limit = Number(c.req.query('limit')) || 50
  const rows = await db.query.messages.findMany({
    where: eq(messages.projectId, project.id),
    orderBy: [desc(messages.createdAt)],
    limit,
  })

  return c.json({ messages: rows.reverse() })
})

export { messageRoutes }
