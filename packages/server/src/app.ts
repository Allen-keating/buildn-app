import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { auth } from './routes/auth'
import { projectRoutes } from './routes/projects'
import { fileRoutes } from './routes/files'
import { chatRoutes } from './routes/chat'
import { messageRoutes } from './routes/messages'
import { snapshotRoutes } from './routes/snapshots'
import { deployRoutes } from './routes/deploy'

const app = new Hono()

app.use('/api/*', cors())

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.route('/api/auth', auth)
app.route('/api/projects', projectRoutes)
app.route('/api/projects', fileRoutes)
app.route('/api/projects', chatRoutes)
app.route('/api/projects', messageRoutes)
app.route('/api/projects', snapshotRoutes)
app.route('/api/projects', deployRoutes)

export { app }
