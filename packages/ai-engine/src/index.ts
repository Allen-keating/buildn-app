import type { GenerateRequest, GenerateEvent } from '@buildn/shared'

export async function* generateCode(_request: GenerateRequest): AsyncGenerator<GenerateEvent> {
  // Placeholder — will be implemented in Plan 3 (AI Engine)
  yield {
    type: 'error',
    error: {
      code: 'LLM_TIMEOUT',
      message: 'AI engine not yet implemented',
      retryable: false,
    },
  }
}
