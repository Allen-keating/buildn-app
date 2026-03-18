# Plan 3: AI Code Generation Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the AI code generation engine that receives natural language + project context, calls Claude, parses structured output into file operations, and validates via a post-processing pipeline.

**Architecture:** Pipeline of 5 stages: Intent Classification → Context Assembly → LLM Call (streaming) → Output Parsing → Post-Processing. Exposed as a single `generateCode()` AsyncGenerator. All stages are pure functions or thin wrappers, easily testable in isolation.

**Tech Stack:** Anthropic SDK (Claude), TypeScript compiler API, ESLint (programmatic), Vitest

---

## File Structure

```
packages/ai-engine/
├── src/
│   ├── index.ts                     # Re-export generateCode (modify existing)
│   ├── pipeline.ts                  # Main pipeline orchestrator
│   ├── classifier/
│   │   └── intent.ts                # Intent classification (create/modify/question/deploy)
│   ├── context/
│   │   ├── assembler.ts             # Assemble full prompt from parts
│   │   ├── retriever.ts             # Select relevant files from project
│   │   └── budget.ts                # Token budget management
│   ├── generator/
│   │   ├── llm-client.ts            # Anthropic SDK wrapper, streaming
│   │   ├── stream.ts                # Stream utilities
│   │   └── parser.ts                # Parse LLM output into FileOperation[]
│   ├── postprocess/
│   │   ├── typecheck.ts             # TypeScript type checking
│   │   ├── lint.ts                  # ESLint check + auto-fix
│   │   ├── build-test.ts            # Vite build verification
│   │   └── auto-fix.ts             # Retry orchestrator
│   └── prompts/
│       ├── system.ts                # Base system prompt
│       ├── create-app.ts            # Create new app prompt
│       ├── modify-code.ts           # Modify existing code prompt
│       └── fix-error.ts             # Fix error prompt
├── tests/
│   ├── classifier.test.ts
│   ├── parser.test.ts
│   ├── assembler.test.ts
│   ├── budget.test.ts
│   └── pipeline.test.ts
├── package.json                     # (modify: add dependencies)
└── tsconfig.json
```

---

## Task 1: Prompt Templates

**Files:**

- Create: `packages/ai-engine/src/prompts/system.ts`
- Create: `packages/ai-engine/src/prompts/create-app.ts`
- Create: `packages/ai-engine/src/prompts/modify-code.ts`
- Create: `packages/ai-engine/src/prompts/fix-error.ts`

- [ ] **Step 1: Create system.ts**

```typescript
export const SYSTEM_PROMPT = `You are Buildn's AI code generation engine. You generate React + TypeScript + Tailwind CSS applications.

Your output MUST follow this exact format for each file:

---FILE: path/to/file.tsx---
(complete file content)
---END FILE---

Rules:
1. Only output files that need to be created or modified
2. Each file must contain complete content — never use ellipsis or "// rest of code"
3. Use React 19 + TypeScript + Tailwind CSS
4. Use functional components with Hooks
5. Use named exports (not default exports)
6. Include all necessary imports
7. Keep files focused — one component per file`
```

- [ ] **Step 2: Create create-app.ts**

```typescript
export function buildCreatePrompt(userPrompt: string, existingFiles?: string): string {
  let prompt = `Create a new React application based on this request:\n\n${userPrompt}\n\n`
  prompt += `Generate a complete, runnable application with:\n`
  prompt += `- src/App.tsx as the main entry component\n`
  prompt += `- Additional component files as needed in src/components/\n`
  prompt += `- Proper TypeScript types\n`
  prompt += `- Tailwind CSS for styling\n`

  if (existingFiles) {
    prompt += `\nExisting project files for reference:\n${existingFiles}`
  }

  return prompt
}
```

- [ ] **Step 3: Create modify-code.ts**

```typescript
export function buildModifyPrompt(
  userPrompt: string,
  fileTree: string,
  relevantFiles: string,
): string {
  let prompt = `Modify the existing application based on this request:\n\n${userPrompt}\n\n`
  prompt += `Current file tree:\n${fileTree}\n\n`
  prompt += `Relevant file contents:\n${relevantFiles}\n\n`
  prompt += `Only output files that need to be changed. Do not output unchanged files.`
  return prompt
}
```

- [ ] **Step 4: Create fix-error.ts**

```typescript
export function buildFixErrorPrompt(originalCode: string, errors: string[]): string {
  let prompt = `The following code has errors that need to be fixed:\n\n`
  prompt += `${originalCode}\n\n`
  prompt += `Errors:\n${errors.map((e) => `- ${e}`).join('\n')}\n\n`
  prompt += `Fix all errors and output the corrected files.`
  return prompt
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/ai-engine/src/prompts/
git commit -m "feat(ai-engine): add system and task-specific prompt templates"
```

---

## Task 2: Intent Classifier

**Files:**

- Create: `packages/ai-engine/src/classifier/intent.ts`
- Create: `packages/ai-engine/tests/classifier.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// packages/ai-engine/tests/classifier.test.ts
import { describe, it, expect } from 'vitest'
import { classifyIntent } from '../src/classifier/intent'

describe('classifyIntent', () => {
  it('classifies creation requests', () => {
    expect(classifyIntent('帮我做一个计数器应用', false)).toBe('create')
    expect(classifyIntent('Create a todo list app', false)).toBe('create')
  })

  it('classifies modification requests when project exists', () => {
    expect(classifyIntent('把配色改成深色主题', true)).toBe('modify')
    expect(classifyIntent('Add a dark theme', true)).toBe('modify')
  })

  it('classifies questions', () => {
    expect(classifyIntent('这段代码是做什么的？', true)).toBe('question')
    expect(classifyIntent('What does this component do?', true)).toBe('question')
  })

  it('classifies deploy requests', () => {
    expect(classifyIntent('发布这个项目', true)).toBe('deploy')
    expect(classifyIntent('Deploy to production', true)).toBe('deploy')
  })

  it('defaults to create when no project exists', () => {
    expect(classifyIntent('Add a button', false)).toBe('create')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/ai-engine && pnpm test`
Expected: FAIL

- [ ] **Step 3: Implement classifier**

```typescript
// packages/ai-engine/src/classifier/intent.ts
import type { Intent } from '@buildn/shared'

const QUESTION_PATTERNS = [
  /什么|怎么|为什么|是什么|做什么|如何|解释|告诉我/,
  /\?$/,
  /^(what|how|why|explain|describe|tell me|can you)/i,
]

const DEPLOY_PATTERNS = [/发布|部署|上线|deploy|publish|ship/i]

const CREATE_PATTERNS = [/创建|新建|做一个|生成|帮我做|build|create|make|generate|scaffold/i]

export function classifyIntent(prompt: string, hasExistingProject: boolean): Intent {
  const trimmed = prompt.trim()

  if (DEPLOY_PATTERNS.some((p) => p.test(trimmed))) return 'deploy'
  if (QUESTION_PATTERNS.some((p) => p.test(trimmed))) return 'question'
  if (!hasExistingProject || CREATE_PATTERNS.some((p) => p.test(trimmed))) return 'create'

  return 'modify'
}
```

- [ ] **Step 4: Run tests, verify passing**

Run: `cd packages/ai-engine && pnpm test`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add packages/ai-engine/
git commit -m "feat(ai-engine): add keyword-based intent classifier with tests"
```

---

## Task 3: Context Assembly & Token Budget

**Files:**

- Create: `packages/ai-engine/src/context/budget.ts`
- Create: `packages/ai-engine/src/context/retriever.ts`
- Create: `packages/ai-engine/src/context/assembler.ts`
- Create: `packages/ai-engine/tests/budget.test.ts`
- Create: `packages/ai-engine/tests/assembler.test.ts`

- [ ] **Step 1: Create budget.ts**

```typescript
// Simple token estimation: ~4 chars per token for English, ~2 for CJK
export function estimateTokens(text: string): number {
  const cjkCount = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length
  const otherCount = text.length - cjkCount
  return Math.ceil(cjkCount / 2 + otherCount / 4)
}

export function trimToTokenBudget(
  items: { key: string; content: string; priority: number }[],
  budget: number,
): Map<string, string> {
  const sorted = [...items].sort((a, b) => b.priority - a.priority)
  const result = new Map<string, string>()
  let used = 0

  for (const item of sorted) {
    const tokens = estimateTokens(item.content)
    if (used + tokens > budget) continue
    result.set(item.key, item.content)
    used += tokens
  }

  return result
}
```

- [ ] **Step 2: Write budget tests**

```typescript
// packages/ai-engine/tests/budget.test.ts
import { describe, it, expect } from 'vitest'
import { estimateTokens, trimToTokenBudget } from '../src/context/budget'

describe('estimateTokens', () => {
  it('estimates English text', () => {
    const tokens = estimateTokens('Hello world')
    expect(tokens).toBeGreaterThan(0)
    expect(tokens).toBeLessThan(10)
  })

  it('estimates CJK text as more tokens per char', () => {
    const cjk = estimateTokens('你好世界')
    expect(cjk).toBe(2) // 4 chars / 2
  })
})

describe('trimToTokenBudget', () => {
  it('includes high priority items first', () => {
    const items = [
      { key: 'a', content: 'short', priority: 1 },
      { key: 'b', content: 'important', priority: 10 },
    ]
    const result = trimToTokenBudget(items, 5)
    expect(result.has('b')).toBe(true)
  })

  it('drops items that exceed budget', () => {
    const items = [{ key: 'a', content: 'x'.repeat(1000), priority: 1 }]
    const result = trimToTokenBudget(items, 10)
    expect(result.size).toBe(0)
  })
})
```

- [ ] **Step 3: Create retriever.ts**

```typescript
import type { FileMap } from '@buildn/shared'

// Priority: explicitly mentioned > entry files > other files
export function selectRelevantFiles(
  files: FileMap,
  prompt: string,
): { key: string; content: string; priority: number }[] {
  const entries = Object.entries(files)

  return entries.map(([path, content]) => {
    let priority = 1

    // Entry files get higher priority
    if (path === 'src/App.tsx' || path === 'src/main.tsx' || path === 'package.json') {
      priority = 5
    }

    // Files mentioned in the prompt get highest priority
    const fileName = path.split('/').pop() ?? ''
    if (prompt.toLowerCase().includes(fileName.toLowerCase().replace(/\.(tsx?|jsx?)$/, ''))) {
      priority = 10
    }

    return { key: path, content, priority }
  })
}

export function buildFileTree(files: FileMap): string {
  const paths = Object.keys(files).sort()
  return paths.map((p) => `  ${p}`).join('\n')
}
```

- [ ] **Step 4: Create assembler.ts**

```typescript
import type { FileMap, ConversationMessage, Intent } from '@buildn/shared'
import { SYSTEM_PROMPT } from '../prompts/system'
import { buildCreatePrompt } from '../prompts/create-app'
import { buildModifyPrompt } from '../prompts/modify-code'
import { selectRelevantFiles, buildFileTree } from './retriever'
import { trimToTokenBudget } from './budget'

export interface AssembledPrompt {
  systemPrompt: string
  userPrompt: string
}

export function assemblePrompt(
  intent: Intent,
  userInput: string,
  projectFiles: FileMap,
  history: ConversationMessage[],
  tokenBudget: number,
): AssembledPrompt {
  const relevantItems = selectRelevantFiles(projectFiles, userInput)
  const selectedFiles = trimToTokenBudget(relevantItems, Math.floor(tokenBudget * 0.6))

  const fileContents = Array.from(selectedFiles.entries())
    .map(([path, content]) => `--- ${path} ---\n${content}\n--- end ---`)
    .join('\n\n')

  const fileTree = buildFileTree(projectFiles)
  const hasFiles = Object.keys(projectFiles).length > 0

  let userPrompt: string
  if (intent === 'create' || !hasFiles) {
    userPrompt = buildCreatePrompt(userInput, hasFiles ? fileContents : undefined)
  } else {
    userPrompt = buildModifyPrompt(userInput, fileTree, fileContents)
  }

  // Append conversation history summary if present
  if (history.length > 0) {
    const historyText = history
      .slice(-5)
      .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
      .join('\n')
    userPrompt = `Recent conversation:\n${historyText}\n\n${userPrompt}`
  }

  return { systemPrompt: SYSTEM_PROMPT, userPrompt }
}
```

- [ ] **Step 5: Write assembler test**

```typescript
// packages/ai-engine/tests/assembler.test.ts
import { describe, it, expect } from 'vitest'
import { assemblePrompt } from '../src/context/assembler'

describe('assemblePrompt', () => {
  it('assembles create prompt with no existing files', () => {
    const result = assemblePrompt('create', 'Make a counter app', {}, [], 120000)
    expect(result.systemPrompt).toContain('Buildn')
    expect(result.userPrompt).toContain('counter app')
    expect(result.userPrompt).toContain('Create a new React application')
  })

  it('assembles modify prompt with existing files', () => {
    const files = { 'src/App.tsx': 'export function App() { return <div>Hello</div> }' }
    const result = assemblePrompt('modify', 'Add a button', files, [], 120000)
    expect(result.userPrompt).toContain('Modify the existing application')
    expect(result.userPrompt).toContain('src/App.tsx')
  })

  it('includes conversation history', () => {
    const history = [{ role: 'user' as const, content: 'Make a counter' }]
    const result = assemblePrompt('modify', 'Add reset', { 'src/App.tsx': '' }, history, 120000)
    expect(result.userPrompt).toContain('counter')
  })
})
```

- [ ] **Step 6: Run all tests**

Run: `cd packages/ai-engine && pnpm test`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add packages/ai-engine/
git commit -m "feat(ai-engine): add context assembly, token budget, and file retrieval"
```

---

## Task 4: LLM Client & Output Parser

**Files:**

- Create: `packages/ai-engine/src/generator/llm-client.ts`
- Create: `packages/ai-engine/src/generator/parser.ts`
- Create: `packages/ai-engine/src/generator/stream.ts`
- Create: `packages/ai-engine/tests/parser.test.ts`
- Modify: `packages/ai-engine/package.json`

- [ ] **Step 1: Add Anthropic SDK (already in package.json, verify)**

Ensure `@anthropic-ai/sdk` is in dependencies.

- [ ] **Step 2: Create llm-client.ts**

```typescript
import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic() // reads ANTHROPIC_API_KEY from env
  }
  return client
}

export async function* callLLM(
  systemPrompt: string,
  userPrompt: string,
  model: string = 'claude-sonnet-4-6-20250514',
): AsyncGenerator<{ type: 'text'; text: string } | { type: 'done'; fullText: string }> {
  const anthropic = getClient()

  const stream = anthropic.messages.stream({
    model,
    max_tokens: 16384,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  let fullText = ''

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullText += event.delta.text
      yield { type: 'text', text: event.delta.text }
    }
  }

  yield { type: 'done', fullText }
}
```

- [ ] **Step 3: Create parser.ts**

````typescript
import type { FileMap, FileOperation } from '@buildn/shared'

const FILE_REGEX = /---FILE:\s*(.+?)---\n([\s\S]*?)---END FILE---/g

export function parseFileOperations(llmOutput: string, existingFiles: FileMap): FileOperation[] {
  const operations: FileOperation[] = []
  let match: RegExpExecArray | null

  // Reset regex state
  FILE_REGEX.lastIndex = 0

  while ((match = FILE_REGEX.exec(llmOutput)) !== null) {
    const path = match[1].trim()
    const content = match[2].trimEnd()

    if (path in existingFiles) {
      operations.push({ type: 'modify', path, content })
    } else {
      operations.push({ type: 'create', path, content })
    }
  }

  // Fallback: try to parse fenced code blocks if no ---FILE: matches
  if (operations.length === 0) {
    const codeBlockRegex = /```(?:tsx?|jsx?|css|json|html)\n\/\/\s*(.+?)\n([\s\S]*?)```/g
    while ((match = codeBlockRegex.exec(llmOutput)) !== null) {
      const path = match[1].trim()
      const content = match[2].trimEnd()
      const type = path in existingFiles ? 'modify' : 'create'
      operations.push({ type, path, content })
    }
  }

  return operations
}
````

- [ ] **Step 4: Write parser tests**

````typescript
// packages/ai-engine/tests/parser.test.ts
import { describe, it, expect } from 'vitest'
import { parseFileOperations } from '../src/generator/parser'

describe('parseFileOperations', () => {
  it('parses ---FILE: format', () => {
    const output = `---FILE: src/App.tsx---
export function App() { return <div>Hello</div> }
---END FILE---

---FILE: src/components/Button.tsx---
export function Button() { return <button>Click</button> }
---END FILE---`

    const ops = parseFileOperations(output, {})
    expect(ops).toHaveLength(2)
    expect(ops[0]).toEqual({
      type: 'create',
      path: 'src/App.tsx',
      content: 'export function App() { return <div>Hello</div> }',
    })
  })

  it('detects modify vs create based on existing files', () => {
    const existing = { 'src/App.tsx': 'old content' }
    const output = `---FILE: src/App.tsx---
new content
---END FILE---`

    const ops = parseFileOperations(output, existing)
    expect(ops[0].type).toBe('modify')
  })

  it('falls back to code block parsing', () => {
    const output = '```tsx\n// src/App.tsx\nexport function App() {}\n```'
    const ops = parseFileOperations(output, {})
    expect(ops).toHaveLength(1)
    expect(ops[0].path).toBe('src/App.tsx')
  })

  it('returns empty array for unparseable output', () => {
    const ops = parseFileOperations('Just some text with no files', {})
    expect(ops).toHaveLength(0)
  })
})
````

- [ ] **Step 5: Create stream.ts**

```typescript
// Utility: collect async generator into array (for testing)
export async function collectStream<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const results: T[] = []
  for await (const item of gen) {
    results.push(item)
  }
  return results
}
```

- [ ] **Step 6: Run tests**

Run: `cd packages/ai-engine && pnpm test`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add packages/ai-engine/
git commit -m "feat(ai-engine): add LLM client, output parser with fallback, and tests"
```

---

## Task 5: Post-Processing Pipeline

**Files:**

- Create: `packages/ai-engine/src/postprocess/typecheck.ts`
- Create: `packages/ai-engine/src/postprocess/lint.ts`
- Create: `packages/ai-engine/src/postprocess/build-test.ts`
- Create: `packages/ai-engine/src/postprocess/auto-fix.ts`

- [ ] **Step 1: Create typecheck.ts**

```typescript
import type { FileMap, ValidationResult } from '@buildn/shared'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

export function runTypeCheck(files: FileMap): ValidationResult {
  const dir = join(tmpdir(), `buildn-tc-${randomUUID()}`)
  try {
    mkdirSync(dir, { recursive: true })

    // Write tsconfig
    writeFileSync(
      join(dir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          jsx: 'react-jsx',
          strict: true,
          noEmit: true,
          skipLibCheck: true,
        },
        include: ['**/*.ts', '**/*.tsx'],
      }),
    )

    // Write files
    for (const [path, content] of Object.entries(files)) {
      const fullPath = join(dir, path)
      mkdirSync(join(fullPath, '..'), { recursive: true })
      writeFileSync(fullPath, content)
    }

    execSync('npx tsc --noEmit', { cwd: dir, stdio: 'pipe', timeout: 30000 })
    return { step: 'typecheck', passed: true }
  } catch (err) {
    const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? String(err)
    const errors = stderr.split('\n').filter((l) => l.includes('error TS'))
    return { step: 'typecheck', passed: false, errors }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
```

- [ ] **Step 2: Create lint.ts**

```typescript
import type { ValidationResult } from '@buildn/shared'

// Lightweight lint check — just validates common patterns
// Full ESLint integration deferred to Phase 2
export function runLintCheck(fileContent: string, filePath: string): ValidationResult {
  const errors: string[] = []

  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    // Check for common issues
    if (fileContent.includes('any ') && !fileContent.includes('// eslint-disable')) {
      // Advisory only, don't fail
    }
    if (fileContent.includes('console.log') && !filePath.includes('test')) {
      errors.push(`${filePath}: console.log found (consider removing)`)
    }
  }

  return { step: 'lint', passed: true, errors: errors.length > 0 ? errors : undefined }
}
```

- [ ] **Step 3: Create build-test.ts**

```typescript
import type { FileMap, ValidationResult } from '@buildn/shared'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

export function runBuildTest(files: FileMap): ValidationResult {
  // Only run build test if there's a package.json with a build script
  if (!files['package.json']) {
    return { step: 'build', passed: true }
  }

  const dir = join(tmpdir(), `buildn-build-${randomUUID()}`)
  try {
    mkdirSync(dir, { recursive: true })

    for (const [path, content] of Object.entries(files)) {
      const fullPath = join(dir, path)
      mkdirSync(join(fullPath, '..'), { recursive: true })
      writeFileSync(fullPath, content)
    }

    execSync('npm install --ignore-scripts 2>/dev/null && npx vite build', {
      cwd: dir,
      stdio: 'pipe',
      timeout: 60000,
    })

    return { step: 'build', passed: true }
  } catch (err) {
    const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? String(err)
    return { step: 'build', passed: false, errors: [stderr.slice(0, 1000)] }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
```

- [ ] **Step 4: Create auto-fix.ts**

```typescript
import type { FileMap, FileOperation, ValidationResult, GenerateEvent } from '@buildn/shared'
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
  // Build the file map with applied operations
  const currentFiles = { ...existingFiles }
  for (const op of operations) {
    if (op.type === 'delete') {
      delete currentFiles[op.path]
    } else if (op.content) {
      currentFiles[op.path] = op.content
    }
  }

  // Run type check
  const tcResult = runTypeCheck(currentFiles)
  yield { type: 'validation', result: tcResult }

  if (tcResult.passed) {
    return // All good
  }

  // Retry loop
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

    // Update files and recheck
    for (const op of fixedOps) {
      if (op.content) currentFiles[op.path] = op.content
    }

    const recheck = runTypeCheck(currentFiles)
    yield { type: 'validation', result: recheck }

    if (recheck.passed) {
      // Replace operations with fixed ones
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
```

- [ ] **Step 5: Typecheck and commit**

Run: `cd packages/ai-engine && pnpm typecheck`

```bash
git add packages/ai-engine/
git commit -m "feat(ai-engine): add post-processing pipeline (typecheck, lint, build, auto-fix)"
```

---

## Task 6: Main Pipeline Orchestrator

**Files:**

- Create: `packages/ai-engine/src/pipeline.ts`
- Modify: `packages/ai-engine/src/index.ts`

- [ ] **Step 1: Create pipeline.ts**

```typescript
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

  // Step 1: Classify intent
  const intent = classifyIntent(prompt, hasProject)
  yield { type: 'intent', intent }

  // Step 2: If question, just answer — no code generation
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

  // Step 3: Assemble context
  const { systemPrompt, userPrompt } = assemblePrompt(
    intent,
    prompt,
    projectFiles,
    conversationHistory,
    tokenBudget,
  )

  // Step 4: Call LLM with streaming
  let fullText = ''
  for await (const chunk of callLLM(systemPrompt, userPrompt, model)) {
    if (chunk.type === 'text') {
      yield { type: 'token', text: chunk.text }
      fullText += chunk.text
    }
  }

  // Step 5: Parse output
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

  // Step 6: Post-processing (optional)
  if (!skipPostProcess) {
    for await (const event of autoFixPipeline(operations, projectFiles, maxRetries)) {
      yield event
      if (event.type === 'error') return
    }
  }

  yield { type: 'done', operations }
}
```

- [ ] **Step 2: Update index.ts**

```typescript
export { generateCode } from './pipeline'
```

- [ ] **Step 3: Typecheck and run all tests**

Run: `cd packages/ai-engine && pnpm typecheck && pnpm test`
Expected: All pass

- [ ] **Step 4: Verify monorepo build**

Run: `pnpm build`
Expected: All packages build

- [ ] **Step 5: Commit**

```bash
git add packages/ai-engine/
git commit -m "feat(ai-engine): implement main pipeline orchestrator connecting all stages"
```
