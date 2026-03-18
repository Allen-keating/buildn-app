'use client'

import { create } from 'zustand'
import type { FileOperation } from '@buildn/shared'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  fileOperations?: FileOperation[]
  status: 'pending' | 'streaming' | 'done' | 'error'
}

interface ChatStore {
  messages: ChatMessage[]
  isGenerating: boolean
  addUserMessage: (content: string) => string
  addAssistantPlaceholder: () => string
  appendToAssistant: (text: string) => void
  setAssistantFileOps: (ops: FileOperation[]) => void
  finalizeAssistant: (status: 'done' | 'error') => void
  setIsGenerating: (v: boolean) => void
  reset: () => void
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isGenerating: false,

  addUserMessage: (content) => {
    const id = crypto.randomUUID()
    set((s) => ({
      messages: [...s.messages, { id, role: 'user', content, status: 'done' }],
    }))
    return id
  },

  addAssistantPlaceholder: () => {
    const id = crypto.randomUUID()
    set((s) => ({
      messages: [...s.messages, { id, role: 'assistant', content: '', status: 'streaming' }],
    }))
    return id
  },

  appendToAssistant: (text) =>
    set((s) => {
      const msgs = [...s.messages]
      const last = findLastAssistant(msgs)
      if (last) last.content += text
      return { messages: msgs }
    }),

  setAssistantFileOps: (ops) =>
    set((s) => {
      const msgs = [...s.messages]
      const last = findLastAssistant(msgs)
      if (last) last.fileOperations = [...(last.fileOperations ?? []), ...ops]
      return { messages: msgs }
    }),

  finalizeAssistant: (status) =>
    set((s) => {
      const msgs = [...s.messages]
      const last = findLastAssistant(msgs)
      if (last) last.status = status
      return { messages: msgs }
    }),

  setIsGenerating: (v) => set({ isGenerating: v }),
  reset: () => set({ messages: [], isGenerating: false }),
}))

function findLastAssistant(msgs: ChatMessage[]): ChatMessage | undefined {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === 'assistant') return msgs[i]
  }
  return undefined
}
