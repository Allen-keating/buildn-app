'use client'

import { useCallback } from 'react'
import { useChatStore } from '@/lib/stores/chat-store'
import { streamChat } from '@/lib/chat/sse-client'
import { getSandbox, writeFilesToContainer, hasPackageJsonChanged, installDeps } from '@buildn/sandbox'
import { MessageList } from './message-list'
import { ChatInput } from './chat-input'
import type { FileMap } from '@buildn/shared'

interface ChatPanelProps {
  projectId: string
  currentFiles: FileMap
  onFilesChanged?: (files: FileMap) => void
  onFileClick?: (path: string) => void
}

export function ChatPanel({ projectId, currentFiles, onFilesChanged, onFileClick }: ChatPanelProps) {
  const { messages, isGenerating, addUserMessage, addAssistantPlaceholder, appendToAssistant, setAssistantFileOps, finalizeAssistant, setIsGenerating } = useChatStore()

  const handleSend = useCallback(async (prompt: string) => {
    if (isGenerating) return

    addUserMessage(prompt)
    addAssistantPlaceholder()
    setIsGenerating(true)

    const filesBefore = { ...currentFiles }

    try {
      await streamChat(projectId, prompt, {
        onToken: (text) => appendToAssistant(text),
        onFileOperation: (op) => setAssistantFileOps([op]),
        onDone: async (operations) => {
          finalizeAssistant('done')

          const updatedFiles = { ...currentFiles }
          for (const op of operations) {
            if (op.type === 'delete') delete updatedFiles[op.path]
            else if (op.content) updatedFiles[op.path] = op.content
          }
          onFilesChanged?.(updatedFiles)

          const wc = getSandbox()
          if (wc && operations.length > 0) {
            const newFileMap: Record<string, string> = {}
            for (const op of operations) {
              if (op.type !== 'delete' && op.content) newFileMap[op.path] = op.content
            }
            await writeFilesToContainer(wc, newFileMap)
            if (hasPackageJsonChanged(filesBefore, updatedFiles)) await installDeps(wc)
          }
        },
        onError: (error) => {
          appendToAssistant(`\n\nError: ${error.message}`)
          finalizeAssistant('error')
        },
      })
    } catch (err) {
      appendToAssistant(`\n\nError: ${err instanceof Error ? err.message : String(err)}`)
      finalizeAssistant('error')
    } finally {
      setIsGenerating(false)
    }
  }, [projectId, currentFiles, isGenerating, addUserMessage, addAssistantPlaceholder, appendToAssistant, setAssistantFileOps, finalizeAssistant, setIsGenerating, onFilesChanged])

  return (
    <div className="flex h-full flex-col">
      <MessageList messages={messages} onFileClick={onFileClick} />
      <ChatInput onSubmit={handleSend} disabled={isGenerating} />
    </div>
  )
}
