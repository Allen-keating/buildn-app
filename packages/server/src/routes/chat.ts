import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { streamSSE } from 'hono/streaming'
import { authMiddleware } from '../middleware/auth'
import { getProject } from '../services/project.service'
import { streamChat } from '../services/chat.service'

const chatRoutes = new Hono<AppEnv>()

chatRoutes.use('*', authMiddleware)

chatRoutes.post('/:id/chat', async (c) => {
  const user = c.get('user')
  const project = await getProject(c.req.param('id'), user.id)
  if (!project) return c.json({ error: 'Project not found' }, 404)

  const { prompt } = await c.req.json<{ prompt: string }>()
  if (!prompt) return c.json({ error: 'prompt is required' }, 400)

  return streamSSE(c, async (stream) => {
    try {
      for await (const event of streamChat(project.id, prompt)) {
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        })
      }
    } catch (err) {
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({
          type: 'error',
          error: {
            code: 'LLM_TIMEOUT',
            message: String(err),
            retryable: true,
          },
        }),
      })
    }
  })
})

export { chatRoutes }
