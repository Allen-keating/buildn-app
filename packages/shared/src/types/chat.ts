import type { FileOperation } from './file'

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  fileOperations?: FileOperation[]
  status: 'pending' | 'streaming' | 'done' | 'error'
  createdAt: Date
}
