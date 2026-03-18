import type { FileMap, FileOperation, GenerateEvent } from '@buildn/shared'
import { runTypeCheck } from './typecheck'
import { callLLM } from '../generator/llm-client'
import { parseFileOperations } from '../generator/parser'
import { buildFixErrorPrompt } from '../prompts/fix-error'
import { SYSTEM_PROMPT } from '../prompts/system'

export async function* autoFixPipeline(
  operations: FileOperation[],
  existingFiles: FileMap,
  maxRetries: number,
): AsyncGenerator<GenerateEvent> {
  const currentFiles = { ...existingFiles }
  for (const op of operations) {
    if (op.type === 'delete') {
      delete currentFiles[op.path]
    } else if (op.content) {
      currentFiles[op.path] = op.content
    }
  }

  const tcResult = runTypeCheck(currentFiles)
  yield { type: 'validation', result: tcResult }

  if (tcResult.passed) return

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    yield { type: 'retry', attempt, errors: tcResult.errors ?? [] }

    const codeContext = operations
      .filter((op) => op.content)
      .map((op) => `---FILE: ${op.path}---\n${op.content}\n---END FILE---`)
      .join('\n\n')

    const fixPrompt = buildFixErrorPrompt(codeContext, tcResult.errors ?? [])

    let fullText = ''
    for await (const chunk of callLLM(SYSTEM_PROMPT, fixPrompt)) {
      if (chunk.type === 'text') fullText += chunk.text
    }

    const fixedOps = parseFileOperations(fullText, existingFiles)
    if (fixedOps.length === 0) continue

    for (const op of fixedOps) {
      if (op.content) currentFiles[op.path] = op.content
    }

    const recheck = runTypeCheck(currentFiles)
    yield { type: 'validation', result: recheck }

    if (recheck.passed) {
      operations.splice(0, operations.length, ...fixedOps)
      return
    }
  }

  yield {
    type: 'error',
    error: {
      code: 'MAX_RETRIES_EXCEEDED',
      message: `Failed to fix type errors after ${maxRetries} attempts`,
      retryable: false,
    },
  }
}
