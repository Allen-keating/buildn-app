import type { GenerateEvent, FileOperation } from '@buildn/shared'

export interface SSECallbacks {
  onToken: (text: string) => void
  onFileOperation: (op: FileOperation) => void
  onDone: (operations: FileOperation[]) => void
  onError: (error: { code: string; message: string }) => void
  onIntent?: (intent: string) => void
}

export async function streamChat(
  projectId: string,
  prompt: string,
  callbacks: SSECallbacks,
): Promise<void> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, prompt }),
  })

  if (!res.ok) {
    const text = await res.text()
    callbacks.onError({ code: 'HTTP_ERROR', message: text || `HTTP ${res.status}` })
    return
  }

  const reader = res.body?.getReader()
  if (!reader) {
    callbacks.onError({ code: 'NO_BODY', message: 'No response body' })
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    while (buffer.includes('\n')) {
      const idx = buffer.indexOf('\n')
      const line = buffer.slice(0, idx).trim()
      buffer = buffer.slice(idx + 1)

      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (!data) continue

      try {
        const event = JSON.parse(data) as GenerateEvent
        switch (event.type) {
          case 'token': callbacks.onToken(event.text); break
          case 'file_operation': callbacks.onFileOperation(event.operation); break
          case 'done': callbacks.onDone(event.operations); break
          case 'error': callbacks.onError(event.error); break
          case 'intent': callbacks.onIntent?.(event.intent); break
        }
      } catch { /* skip */ }
    }
  }
}
