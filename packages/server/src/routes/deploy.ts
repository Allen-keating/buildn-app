import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { authMiddleware } from '../middleware/auth'
import { getProject } from '../services/project.service'
import { startDeploy, getDeployStatusForProject } from '../services/deploy.service'

const deployRoutes = new Hono<AppEnv>()

deployRoutes.use('*', authMiddleware)

deployRoutes.post('/:id/deploy', async (c) => {
  const user = c.get('user')
  const project = await getProject(c.req.param('id'), user.id)
  if (!project) return c.json({ error: 'Project not found' }, 404)

  const result = await startDeploy(project.id)
  if ('error' in result) return c.json({ error: result.error }, 409)

  return c.json({ deployId: result.deploy.id, status: 'queued' })
})

deployRoutes.get('/:id/deploy/status', async (c) => {
  const user = c.get('user')
  const project = await getProject(c.req.param('id'), user.id)
  if (!project) return c.json({ error: 'Project not found' }, 404)

  const status = await getDeployStatusForProject(project.id)
  if (!status) return c.json({ error: 'No deployments found' }, 404)

  return c.json(status)
})

export { deployRoutes }
