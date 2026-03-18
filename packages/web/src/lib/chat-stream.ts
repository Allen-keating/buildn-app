import type { GenerateEvent } from '@buildn/shared'

export async function* consumeSSE(response: Response): AsyncGenerator<GenerateEvent> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (line.startsWith('data:')) {
        const data = line.slice(5).trim()
        if (data) {
          try {
            yield JSON.parse(data) as GenerateEvent
          } catch {
            // Skip unparseable lines
          }
        }
      }
    }
  }
}
