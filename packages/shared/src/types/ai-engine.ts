import type { FileMap, FileOperation } from './file'
import type { ConversationMessage } from './chat'

export type Intent = 'create' | 'modify' | 'question' | 'deploy'

export interface GenerateRequest {
  prompt: string
  projectFiles: FileMap
  conversationHistory: ConversationMessage[]
  config?: GenerateConfig
}

export interface GenerateConfig {
  model?: string
  maxRetries?: number
  tokenBudget?: number
  skipPostProcess?: boolean
}

export type GenerateEvent =
  | { type: 'intent'; intent: Intent }
  | { type: 'token'; text: string }
  | { type: 'file_operation'; operation: FileOperation }
  | { type: 'validation'; result: ValidationResult }
  | { type: 'retry'; attempt: number; errors: string[] }
  | { type: 'done'; operations: FileOperation[] }
  | { type: 'error'; error: EngineError }

export interface ValidationResult {
  step: 'typecheck' | 'lint' | 'build'
  passed: boolean
  errors?: string[]
}

export interface EngineError {
  code:
    | 'LLM_TIMEOUT'
    | 'LLM_RATE_LIMIT'
    | 'PARSE_FAILED'
    | 'MAX_RETRIES_EXCEEDED'
    | 'TOKEN_BUDGET_EXCEEDED'
  message: string
  retryable: boolean
}
