import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { authMiddleware } from '../middleware/auth'
import { getProject } from '../services/project.service'
import { listFiles, readFile, writeFile, deleteFile } from '../services/file.service'

const fileRoutes = new Hono<AppEnv>()

fileRoutes.use('*', authMiddleware)

fileRoutes.get('/:id/files', async (c) => {
  const user = c.get('user')
  const project = await getProject(c.req.param('id'), user.id)
  if (!project) return c.json({ error: 'Project not found' }, 404)

  const tree = await listFiles(project.id)
  return c.json({ tree })
})

fileRoutes.get('/:id/files/*', async (c) => {
  const user = c.get('user')
  const project = await getProject(c.req.param('id'), user.id)
  if (!project) return c.json({ error: 'Project not found' }, 404)

  const filePath = c.req.path.replace(/^\/api\/projects\/[^/]+\/files\//, '')
  const result = await readFile(project.id, filePath)
  if (!result) return c.json({ error: 'File not found' }, 404)
  if ('error' in result) return c.json({ error: result.error }, 400)

  return c.json(result)
})

fileRoutes.put('/:id/files/*', async (c) => {
  const user = c.get('user')
  const project = await getProject(c.req.param('id'), user.id)
  if (!project) return c.json({ error: 'Project not found' }, 404)

  const filePath = c.req.path.replace(/^\/api\/projects\/[^/]+\/files\//, '')
  const { content } = await c.req.json<{ content: string }>()
  if (content === undefined) return c.json({ error: 'content is required' }, 400)

  const result = await writeFile(project.id, filePath, content)
  if ('error' in result) return c.json({ error: result.error }, 400)

  return c.json(result)
})

fileRoutes.delete('/:id/files/*', async (c) => {
  const user = c.get('user')
  const project = await getProject(c.req.param('id'), user.id)
  if (!project) return c.json({ error: 'Project not found' }, 404)

  const filePath = c.req.path.replace(/^\/api\/projects\/[^/]+\/files\//, '')
  const deleted = await deleteFile(project.id, filePath)
  if (typeof deleted === 'object' && 'error' in deleted)
    return c.json({ error: deleted.error }, 400)
  if (!deleted) return c.json({ error: 'File not found' }, 404)

  return c.body(null, 204)
})

export { fileRoutes }
