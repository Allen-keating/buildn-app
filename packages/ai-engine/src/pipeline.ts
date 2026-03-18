import type { GenerateRequest, GenerateEvent } from '@buildn/shared'
import { classifyIntent } from './classifier'
import { assemblePrompt } from './context'
import { callLLM } from './llm-client'
import { parseFileOperations } from './parser'
import { postProcess } from './postprocess'

export async function generateCode(
  request: GenerateRequest,
  onEvent: (event: GenerateEvent) => void,
): Promise<void> {
  const { prompt, projectFiles, conversationHistory, model, maxRetries = 2, tokenBudget = 100000 } = request
  const hasProject = Object.keys(projectFiles).length > 0

  // 1. Classify intent
  const intent = classifyIntent(prompt, hasProject)
  onEvent({ type: 'intent', intent })

  // 2. Assemble prompt
  const { systemPrompt, userPrompt } = assemblePrompt(
    intent, prompt, projectFiles, conversationHistory, tokenBudget,
  )

  // 3. Call LLM with streaming tokens
  let fullText: string
  try {
    fullText = await callLLM(systemPrompt, userPrompt, model, (text) => {
      onEvent({ type: 'token', text })
    })
  } catch (err) {
    onEvent({ type: 'error', error: { code: 'LLM_ERROR', message: String(err) } })
    return
  }

  // 4. Parse output
  const operations = parseFileOperations(fullText, projectFiles)
  for (const op of operations) {
    onEvent({ type: 'file_operation', operation: op })
  }

  if (operations.length === 0) {
    onEvent({ type: 'done', operations: [] })
    return
  }

  // 5. Post-process (skip for questions)
  let finalOps = operations
  if (intent !== 'question') {
    try {
      finalOps = await postProcess(operations, projectFiles, maxRetries, onEvent)
    } catch {
      // Post-processing failed, use original operations
    }
  }

  onEvent({ type: 'done', operations: finalOps })
}
