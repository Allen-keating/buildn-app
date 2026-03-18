import type { GenerateRequest, GenerateEvent } from '@buildn/shared'
import { classifyIntent } from './classifier/intent'
import { assemblePrompt } from './context/assembler'
import { callLLM } from './generator/llm-client'
import { parseFileOperations } from './generator/parser'
import { autoFixPipeline } from './postprocess/auto-fix'

export async function* generateCode(request: GenerateRequest): AsyncGenerator<GenerateEvent> {
  const { prompt, projectFiles, conversationHistory, config } = request
  const model = config?.model ?? 'claude-sonnet-4-6-20250514'
  const maxRetries = config?.maxRetries ?? 3
  const tokenBudget = config?.tokenBudget ?? 120_000
  const skipPostProcess = config?.skipPostProcess ?? false

  const hasProject = Object.keys(projectFiles).length > 0

  const intent = classifyIntent(prompt, hasProject)
  yield { type: 'intent', intent }

  if (intent === 'question') {
    const { systemPrompt, userPrompt } = assemblePrompt(
      intent,
      prompt,
      projectFiles,
      conversationHistory,
      tokenBudget,
    )
    for await (const chunk of callLLM(systemPrompt, userPrompt, model)) {
      if (chunk.type === 'text') yield { type: 'token', text: chunk.text }
    }
    yield { type: 'done', operations: [] }
    return
  }

  const { systemPrompt, userPrompt } = assemblePrompt(
    intent,
    prompt,
    projectFiles,
    conversationHistory,
    tokenBudget,
  )

  let fullText = ''
  for await (const chunk of callLLM(systemPrompt, userPrompt, model)) {
    if (chunk.type === 'text') {
      yield { type: 'token', text: chunk.text }
      fullText += chunk.text
    }
  }

  const operations = parseFileOperations(fullText, projectFiles)
  for (const op of operations) {
    yield { type: 'file_operation', operation: op }
  }

  if (operations.length === 0) {
    yield {
      type: 'error',
      error: {
        code: 'PARSE_FAILED',
        message: 'Could not parse any file operations from LLM output',
        retryable: true,
      },
    }
    return
  }

  if (!skipPostProcess) {
    for await (const event of autoFixPipeline(operations, projectFiles, maxRetries)) {
      yield event
      if (event.type === 'error') return
    }
  }

  yield { type: 'done', operations }
}
