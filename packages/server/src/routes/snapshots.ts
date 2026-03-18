import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { authMiddleware } from '../middleware/auth'
import { getProject } from '../services/project.service'
import { listSnapshots, restoreSnapshot } from '../services/snapshot.service'

const snapshotRoutes = new Hono<AppEnv>()

snapshotRoutes.use('*', authMiddleware)

snapshotRoutes.get('/:id/snapshots', async (c) => {
  const user = c.get('user')
  const project = await getProject(c.req.param('id'), user.id)
  if (!project) return c.json({ error: 'Project not found' }, 404)

  const list = await listSnapshots(project.id)
  return c.json({ snapshots: list })
})

snapshotRoutes.post('/:id/snapshots/:sid/restore', async (c) => {
  const user = c.get('user')
  const project = await getProject(c.req.param('id'), user.id)
  if (!project) return c.json({ error: 'Project not found' }, 404)

  const files = await restoreSnapshot(project.id, c.req.param('sid'))
  if (!files) return c.json({ error: 'Snapshot not found' }, 404)

  return c.json({ files })
})

export { snapshotRoutes }
