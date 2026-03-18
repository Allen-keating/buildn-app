import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { authMiddleware } from '../middleware/auth'
import {
  listProjects,
  getProject,
  getProjectFiles,
  createProject,
  updateProject,
  deleteProject,
} from '../services/project.service'

const projectRoutes = new Hono<AppEnv>()

projectRoutes.use('*', authMiddleware)

projectRoutes.get('/', async (c) => {
  const user = c.get('user')
  const list = await listProjects(user.id)
  return c.json({ projects: list })
})

projectRoutes.post('/', async (c) => {
  const user = c.get('user')
  const body = await c.req.json<{ name: string; description?: string; template?: string }>()

  if (!body.name) return c.json({ error: 'name is required' }, 400)

  const result = await createProject(user.id, user.plan, body)
  if ('error' in result) return c.json({ error: result.error }, 403)

  return c.json({ project: result.project }, 201)
})

projectRoutes.get('/:id', async (c) => {
  const user = c.get('user')
  const project = await getProject(c.req.param('id'), user.id)
  if (!project) return c.json({ error: 'Project not found' }, 404)

  const files = await getProjectFiles(project.id)
  return c.json({ project, files })
})

projectRoutes.patch('/:id', async (c) => {
  const user = c.get('user')
  const body = await c.req.json<{ name?: string; description?: string }>()
  const project = await updateProject(c.req.param('id'), user.id, body)
  if (!project) return c.json({ error: 'Project not found' }, 404)

  return c.json({ project })
})

projectRoutes.delete('/:id', async (c) => {
  const user = c.get('user')
  const deleted = await deleteProject(c.req.param('id'), user.id)
  if (!deleted) return c.json({ error: 'Project not found' }, 404)

  return c.body(null, 204)
})

export { projectRoutes }
