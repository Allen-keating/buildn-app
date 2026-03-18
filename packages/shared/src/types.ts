export interface Profile {
  id: string
  name: string
  avatar_url: string | null
  plan: 'free' | 'pro' | 'team'
  created_at: string
}

export interface Project {
  id: string
  user_id: string
  name: string
  description: string
  template: string
  status: 'draft' | 'published'
  deploy_url: string | null
  github_repo: string | null
  created_at: string
  updated_at: string
}

export const PLAN_LIMITS = { free: 5, pro: 50, team: 200 } as const

// === AI Engine Types ===

export type Intent = 'create' | 'modify' | 'question' | 'deploy'

export type FileMap = Record<string, string>

export interface FileOperation {
  type: 'create' | 'modify' | 'delete'
  path: string
  content?: string
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface GenerateRequest {
  prompt: string
  projectFiles: FileMap
  conversationHistory: ConversationMessage[]
  model?: string
  maxRetries?: number
  tokenBudget?: number
}

export type GenerateEvent =
  | { type: 'intent'; intent: Intent }
  | { type: 'token'; text: string }
  | { type: 'file_operation'; operation: FileOperation }
  | { type: 'error'; error: { code: string; message: string } }
  | { type: 'done'; operations: FileOperation[] }
