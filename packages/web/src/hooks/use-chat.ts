import { useCallback } from 'react'
import { useAppStore } from '../stores/app-store'
import { api } from '../lib/api'
import { consumeSSE } from '../lib/chat-stream'
import { getSandbox, writeFilesToSandbox } from '../lib/sandbox'
import type { FileOperation } from '@buildn/shared'

export function useChat() {
  const store = useAppStore()

  const sendMessage = useCallback(
    async (prompt: string) => {
      const projectId = store.projectId
      if (!projectId || store.isGenerating) return

      store.addMessage({
        id: crypto.randomUUID(),
        role: 'user',
        content: prompt,
        status: 'done',
        createdAt: new Date(),
      })

      store.addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        status: 'streaming',
        createdAt: new Date(),
      })

      store.setIsGenerating(true)

      try {
        const response = await api.streamChat(projectId, prompt)
        if (!response.ok) throw new Error(`Chat failed: ${response.status}`)

        const fileOps: FileOperation[] = []

        for await (const event of consumeSSE(response)) {
          switch (event.type) {
            case 'token':
              store.updateLastAssistant({
                content:
                  ([...store.messages].reverse().find((m) => m.role === 'assistant')?.content ?? '') +
                  event.text,
              })
              break

            case 'file_operation':
              fileOps.push(event.operation)
              store.updateLastAssistant({ fileOperations: [...fileOps] })
              break

            case 'done':
              store.updateLastAssistant({ status: 'done' })
              store.applyFileOperations(event.operations)

              const wc = getSandbox()
              if (wc) {
                const newFiles: Record<string, string> = {}
                for (const op of event.operations) {
                  if (op.type !== 'delete' && op.content) {
                    newFiles[op.path] = op.content
                  }
                }
                await writeFilesToSandbox(wc, newFiles)
              }
              break

            case 'error':
              store.updateLastAssistant({ status: 'error', content: event.error.message })
              break
          }
        }
      } catch (err) {
        store.updateLastAssistant({
          status: 'error',
          content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        })
      } finally {
        store.setIsGenerating(false)
      }
    },
    [store],
  )

  return { sendMessage }
}
