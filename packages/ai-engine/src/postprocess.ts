import type { FileMap, FileOperation, GenerateEvent } from '@buildn/shared'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { callLLM } from './llm-client'
import { parseFileOperations } from './parser'
import { SYSTEM_PROMPT, buildFixPrompt } from './prompts'

interface ValidationResult {
  passed: boolean
  errors: string[]
}

function runTypeCheck(files: FileMap): ValidationResult {
  const dir = join(tmpdir(), `buildn-tc-${randomUUID()}`)
  try {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler', jsx: 'react-jsx', strict: true, noEmit: true, skipLibCheck: true },
      include: ['**/*.ts', '**/*.tsx'],
    }))
    for (const [path, content] of Object.entries(files)) {
      const fullPath = join(dir, path)
      mkdirSync(join(fullPath, '..'), { recursive: true })
      writeFileSync(fullPath, content)
    }
    execSync('npx tsc --noEmit', { cwd: dir, stdio: 'pipe', timeout: 30000 })
    return { passed: true, errors: [] }
  } catch (err) {
    const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? ''
    return { passed: false, errors: stderr.split('\n').filter(l => l.includes('error TS')) }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

export async function postProcess(
  operations: FileOperation[],
  existingFiles: FileMap,
  maxRetries: number,
  onEvent: (event: GenerateEvent) => void,
): Promise<FileOperation[]> {
  const currentFiles = { ...existingFiles }
  for (const op of operations) {
    if (op.type === 'delete') delete currentFiles[op.path]
    else if (op.content) currentFiles[op.path] = op.content
  }

  const result = runTypeCheck(currentFiles)
  if (result.passed) return operations

  let currentOps = operations
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    onEvent({ type: 'error', error: { code: 'TYPECHECK_RETRY', message: `Type errors found, retrying (${attempt}/${maxRetries})` } })

    const codeContext = currentOps
      .filter(op => op.content)
      .map(op => `---FILE: ${op.path}---\n${op.content}\n---END FILE---`)
      .join('\n\n')

    const fixPrompt = buildFixPrompt(codeContext, result.errors)
    const fixOutput = await callLLM(SYSTEM_PROMPT, fixPrompt)
    const fixedOps = parseFileOperations(fixOutput, existingFiles)
    if (fixedOps.length === 0) continue

    for (const op of fixedOps) {
      if (op.content) currentFiles[op.path] = op.content
    }

    const recheck = runTypeCheck(currentFiles)
    if (recheck.passed) return fixedOps
  }

  return currentOps
}
