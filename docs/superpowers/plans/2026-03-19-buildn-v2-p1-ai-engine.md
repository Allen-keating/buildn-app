# Buildn V2 P1: AI Code Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the AI code generation engine that takes natural language + project context, calls DashScope LLM, parses structured output into file operations, and validates via post-processing — exposed as a tRPC streaming endpoint.

**Architecture:** Standalone `packages/ai-engine` package with a pipeline of stages: Intent Classification → Context Assembly (with token budget) → LLM Streaming Call → Output Parsing → Post-Processing. The server exposes it via a tRPC `chat.send` mutation that streams SSE events to the frontend. All pure functions are unit-tested with Vitest.

**Tech Stack:** DashScope OpenAI-compatible API (Node.js https), TypeScript, Vitest, tRPC streaming, Next.js API routes

---

## File Structure

```
packages/
├── ai-engine/
│   ├── src/
│   │   ├── index.ts                  # Export generateCode
│   │   ├── pipeline.ts               # Main orchestrator
│   │   ├── classifier.ts             # Intent classification
│   │   ├── context.ts                # Context assembly + token budget + file retrieval
│   │   ├── llm-client.ts             # DashScope streaming client
│   │   ├── parser.ts                 # Parse LLM output → FileOperation[]
│   │   ├── postprocess.ts            # TypeCheck + auto-fix retry
│   │   ├── prompts.ts                # All prompt templates
│   │   └── types.ts                  # AI-engine-specific types
│   ├── tests/
│   │   ├── classifier.test.ts
│   │   ├── context.test.ts
│   │   ├── parser.test.ts
│   │   └── pipeline.test.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── vitest.config.ts
packages/
└── shared/src/types.ts                # Add AI types (modify)
apps/web/
├── lib/trpc/routers/
│   ├── chat.ts                        # New: chat.send streaming mutation
│   └── index.ts                       # Modify: add chatRouter
└── app/api/chat/route.ts              # New: SSE streaming endpoint (alternative to tRPC streaming)
```

---

## Task 1: Shared AI Types

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add AI engine types to shared package**

Append to `packages/shared/src/types.ts`:

```typescript
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
```

- [ ] **Step 2: Typecheck**

Run: `cd packages/shared && pnpm typecheck`

- [ ] **Step 3: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): add AI engine types"
```

---

## Task 2: AI Engine Package Scaffold

**Files:**
- Create: `packages/ai-engine/package.json`
- Create: `packages/ai-engine/tsconfig.json`
- Create: `packages/ai-engine/vitest.config.ts`
- Create: `packages/ai-engine/src/types.ts`
- Create: `packages/ai-engine/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@buildn/ai-engine",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": { "types": "./src/index.ts", "import": "./src/index.ts", "default": "./src/index.ts" }
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {},
  "devDependencies": {
    "@buildn/shared": "workspace:*",
    "@types/node": "^22",
    "typescript": "^5.7",
    "vitest": "^3"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
  },
})
```

- [ ] **Step 4: Create src/types.ts** (internal types)

```typescript
export interface LLMChunk {
  type: 'text'
  text: string
}

export interface LLMDone {
  type: 'done'
  fullText: string
}

export type LLMEvent = LLMChunk | LLMDone
```

- [ ] **Step 5: Create src/index.ts** (placeholder)

```typescript
export { generateCode } from './pipeline'
```

- [ ] **Step 6: Install and verify**

```bash
cd /Users/allen/AllenProject/buildn-app && pnpm install
```

- [ ] **Step 7: Commit**

```bash
git add packages/ai-engine/
git commit -m "chore(ai-engine): scaffold package with vitest"
```

---

## Task 3: Intent Classifier

**Files:**
- Create: `packages/ai-engine/src/classifier.ts`
- Create: `packages/ai-engine/tests/classifier.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// packages/ai-engine/tests/classifier.test.ts
import { describe, it, expect } from 'vitest'
import { classifyIntent } from '../src/classifier'

describe('classifyIntent', () => {
  it('classifies creation requests', () => {
    expect(classifyIntent('Create a todo app', false)).toBe('create')
    expect(classifyIntent('帮我做一个计数器', false)).toBe('create')
  })

  it('classifies modification when project exists', () => {
    expect(classifyIntent('Add a dark theme', true)).toBe('modify')
    expect(classifyIntent('把按钮改成红色', true)).toBe('modify')
  })

  it('classifies questions', () => {
    expect(classifyIntent('What does this code do?', true)).toBe('question')
    expect(classifyIntent('这段代码是什么意思？', true)).toBe('question')
  })

  it('classifies deploy requests', () => {
    expect(classifyIntent('Deploy this project', true)).toBe('deploy')
    expect(classifyIntent('发布上线', true)).toBe('deploy')
  })

  it('defaults to create when no project', () => {
    expect(classifyIntent('Add a button', false)).toBe('create')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/ai-engine && pnpm test`
Expected: FAIL

- [ ] **Step 3: Implement classifier**

```typescript
// packages/ai-engine/src/classifier.ts
import type { Intent } from '@buildn/shared'

const DEPLOY_RE = /发布|部署|上线|deploy|publish|ship/i
const QUESTION_RE = /什么|怎么|为什么|如何|解释|告诉我|\?$|^(what|how|why|explain|describe|tell me)/i
const CREATE_RE = /创建|新建|做一个|生成|帮我做|build|create|make|generate|scaffold/i

export function classifyIntent(prompt: string, hasProject: boolean): Intent {
  const s = prompt.trim()
  if (DEPLOY_RE.test(s)) return 'deploy'
  if (QUESTION_RE.test(s)) return 'question'
  if (!hasProject || CREATE_RE.test(s)) return 'create'
  return 'modify'
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/ai-engine && pnpm test`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add packages/ai-engine/
git commit -m "feat(ai-engine): add intent classifier with tests"
```

---

## Task 4: Prompt Templates

**Files:**
- Create: `packages/ai-engine/src/prompts.ts`

- [ ] **Step 1: Create prompts.ts**

```typescript
// packages/ai-engine/src/prompts.ts

export const SYSTEM_PROMPT = `You are Buildn's AI code generation engine. You generate React + TypeScript + Tailwind CSS applications.

Your output MUST follow this exact format for each file:

---FILE: path/to/file.tsx---
(complete file content here — NO markdown fences, NO \`\`\`tsx wrappers)
---END FILE---

Rules:
1. Only output files that need to be created or modified
2. Each file must contain COMPLETE content — never abbreviate
3. Use React + TypeScript + Tailwind CSS
4. Use functional components with hooks
5. Use named exports
6. Include all necessary imports
7. Do NOT wrap file content in markdown code fences`

export function buildCreatePrompt(userPrompt: string, existingFiles?: string): string {
  let p = \`Create a new React application based on this request:\n\n\${userPrompt}\n\n\`
  p += \`Generate a complete, runnable application with:\n\`
  p += \`- src/App.tsx as the main entry component\n\`
  p += \`- Additional components in src/components/ as needed\n\`
  p += \`- Tailwind CSS for all styling\n\`
  if (existingFiles) p += \`\nExisting files for reference:\n\${existingFiles}\`
  return p
}

export function buildModifyPrompt(userPrompt: string, fileTree: string, relevantFiles: string): string {
  return \`Modify the existing application:\n\n\${userPrompt}\n\nFile tree:\n\${fileTree}\n\nRelevant files:\n\${relevantFiles}\n\nOnly output changed files.\`
}

export function buildFixPrompt(code: string, errors: string[]): string {
  return \`Fix these errors in the code:\n\n\${code}\n\nErrors:\n\${errors.map(e => \`- \${e}\`).join('\\n')}\n\nOutput corrected files.\`
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
cd packages/ai-engine && pnpm typecheck
git add packages/ai-engine/src/prompts.ts
git commit -m "feat(ai-engine): add prompt templates"
```

---

## Task 5: Context Assembly & Token Budget

**Files:**
- Create: `packages/ai-engine/src/context.ts`
- Create: `packages/ai-engine/tests/context.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// packages/ai-engine/tests/context.test.ts
import { describe, it, expect } from 'vitest'
import { estimateTokens, selectRelevantFiles, assemblePrompt } from '../src/context'

describe('estimateTokens', () => {
  it('estimates English text', () => {
    expect(estimateTokens('Hello world')).toBeGreaterThan(0)
    expect(estimateTokens('Hello world')).toBeLessThan(10)
  })

  it('estimates CJK text', () => {
    expect(estimateTokens('你好世界')).toBe(2)
  })
})

describe('selectRelevantFiles', () => {
  it('prioritizes mentioned files', () => {
    const files = { 'src/App.tsx': 'app', 'src/Button.tsx': 'btn' }
    const result = selectRelevantFiles(files, 'Change the Button component')
    expect(result[0].key).toBe('src/Button.tsx')
  })

  it('prioritizes entry files', () => {
    const files = { 'src/App.tsx': 'app', 'src/utils.ts': 'utils' }
    const result = selectRelevantFiles(files, 'do something')
    const appItem = result.find(r => r.key === 'src/App.tsx')
    const utilsItem = result.find(r => r.key === 'src/utils.ts')
    expect(appItem!.priority).toBeGreaterThan(utilsItem!.priority)
  })
})

describe('assemblePrompt', () => {
  it('builds create prompt when no files', () => {
    const result = assemblePrompt('create', 'Make a counter', {}, [], 100000)
    expect(result.systemPrompt).toContain('Buildn')
    expect(result.userPrompt).toContain('counter')
  })

  it('builds modify prompt with existing files', () => {
    const result = assemblePrompt('modify', 'Add dark mode', { 'src/App.tsx': 'code' }, [], 100000)
    expect(result.userPrompt).toContain('Modify')
    expect(result.userPrompt).toContain('src/App.tsx')
  })
})
```

- [ ] **Step 2: Implement context.ts**

```typescript
// packages/ai-engine/src/context.ts
import type { FileMap, ConversationMessage, Intent } from '@buildn/shared'
import { SYSTEM_PROMPT, buildCreatePrompt, buildModifyPrompt } from './prompts'

export function estimateTokens(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length
  return Math.ceil(cjk / 2 + (text.length - cjk) / 4)
}

export function selectRelevantFiles(
  files: FileMap,
  prompt: string,
): { key: string; content: string; priority: number }[] {
  return Object.entries(files)
    .map(([path, content]) => {
      let priority = 1
      if (['src/App.tsx', 'src/main.tsx', 'package.json'].includes(path)) priority = 5
      const name = path.split('/').pop()?.replace(/\.(tsx?|jsx?)$/, '') ?? ''
      if (prompt.toLowerCase().includes(name.toLowerCase())) priority = 10
      return { key: path, content, priority }
    })
    .sort((a, b) => b.priority - a.priority)
}

export function trimToTokenBudget(
  items: { key: string; content: string }[],
  budget: number,
): Map<string, string> {
  const result = new Map<string, string>()
  let used = 0
  for (const item of items) {
    const tokens = estimateTokens(item.content)
    if (used + tokens > budget) continue
    result.set(item.key, item.content)
    used += tokens
  }
  return result
}

export function assemblePrompt(
  intent: Intent,
  userInput: string,
  projectFiles: FileMap,
  history: ConversationMessage[],
  tokenBudget: number,
): { systemPrompt: string; userPrompt: string } {
  const relevant = selectRelevantFiles(projectFiles, userInput)
  const selected = trimToTokenBudget(relevant, Math.floor(tokenBudget * 0.6))
  const fileContents = Array.from(selected.entries())
    .map(([path, content]) => `--- ${path} ---\n${content}\n--- end ---`)
    .join('\n\n')
  const fileTree = Object.keys(projectFiles).sort().map(p => `  ${p}`).join('\n')
  const hasFiles = Object.keys(projectFiles).length > 0

  let userPrompt: string
  if (intent === 'create' || !hasFiles) {
    userPrompt = buildCreatePrompt(userInput, hasFiles ? fileContents : undefined)
  } else {
    userPrompt = buildModifyPrompt(userInput, fileTree, fileContents)
  }

  if (history.length > 0) {
    const historyText = history.slice(-5).map(m => `${m.role}: ${m.content.slice(0, 200)}`).join('\n')
    userPrompt = `Recent conversation:\n${historyText}\n\n${userPrompt}`
  }

  return { systemPrompt: SYSTEM_PROMPT, userPrompt }
}
```

- [ ] **Step 3: Run tests**

Run: `cd packages/ai-engine && pnpm test`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add packages/ai-engine/
git commit -m "feat(ai-engine): add context assembly with token budget and tests"
```

---

## Task 6: LLM Client (DashScope Streaming)

**Files:**
- Create: `packages/ai-engine/src/llm-client.ts`

- [ ] **Step 1: Create llm-client.ts**

```typescript
// packages/ai-engine/src/llm-client.ts
import https from 'node:https'
import type { LLMEvent } from './types'

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const DEFAULT_MODEL = 'qwen-coder-plus'

function getConfig() {
  const apiKey = process.env.DASHSCOPE_API_KEY
  if (!apiKey) throw new Error('Missing DASHSCOPE_API_KEY')
  return {
    apiKey,
    baseUrl: process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL,
  }
}

function streamRequest(
  url: string,
  apiKey: string,
  body: string,
  onChunk: (text: string) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          let data = ''
          res.on('data', (c) => (data += c))
          res.on('end', () => reject(new Error(`DashScope ${res.statusCode}: ${data}`)))
          return
        }
        let buffer = ''
        res.setEncoding('utf-8')
        res.on('data', (raw: string) => {
          buffer += raw
          while (buffer.includes('\n')) {
            const idx = buffer.indexOf('\n')
            const line = buffer.slice(0, idx).trim()
            buffer = buffer.slice(idx + 1)
            if (!line.startsWith('data:')) continue
            const data = line.slice(5).trim()
            if (!data || data === '[DONE]') continue
            try {
              const json = JSON.parse(data) as {
                choices?: { delta?: { content?: string | null } }[]
                error?: { message?: string }
              }
              if (json.error) { reject(new Error(`DashScope: ${json.error.message}`)); return }
              const content = json.choices?.[0]?.delta?.content
              if (content) onChunk(content)
            } catch { /* skip */ }
          }
        })
        res.on('end', resolve)
        res.on('error', reject)
      },
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  model?: string,
  onToken?: (text: string) => void,
): Promise<string> {
  const { apiKey, baseUrl } = getConfig()
  const url = `${baseUrl}/chat/completions`
  const body = JSON.stringify({
    model: model || DEFAULT_MODEL,
    stream: true,
    max_tokens: 8192,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  const chunks: string[] = []
  await streamRequest(url, apiKey, body, (text) => {
    chunks.push(text)
    onToken?.(text)
  })

  return chunks.join('')
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
cd packages/ai-engine && pnpm typecheck
git add packages/ai-engine/src/llm-client.ts
git commit -m "feat(ai-engine): add DashScope streaming LLM client"
```

---

## Task 7: Output Parser

**Files:**
- Create: `packages/ai-engine/src/parser.ts`
- Create: `packages/ai-engine/tests/parser.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// packages/ai-engine/tests/parser.test.ts
import { describe, it, expect } from 'vitest'
import { parseFileOperations } from '../src/parser'

describe('parseFileOperations', () => {
  it('parses ---FILE: format', () => {
    const output = `---FILE: src/App.tsx---
export function App() { return <div>Hello</div> }
---END FILE---`
    const ops = parseFileOperations(output, {})
    expect(ops).toHaveLength(1)
    expect(ops[0].type).toBe('create')
    expect(ops[0].path).toBe('src/App.tsx')
    expect(ops[0].content).toContain('App')
  })

  it('detects modify vs create', () => {
    const output = `---FILE: src/App.tsx---
new content
---END FILE---`
    const ops = parseFileOperations(output, { 'src/App.tsx': 'old' })
    expect(ops[0].type).toBe('modify')
  })

  it('strips markdown fences from content', () => {
    const output = `---FILE: src/App.tsx---
\`\`\`tsx
export function App() {}
\`\`\`
---END FILE---`
    const ops = parseFileOperations(output, {})
    expect(ops[0].content).not.toContain('```')
    expect(ops[0].content).toContain('export function App')
  })

  it('parses multiple files', () => {
    const output = `---FILE: src/App.tsx---
app content
---END FILE---

---FILE: src/Button.tsx---
button content
---END FILE---`
    const ops = parseFileOperations(output, {})
    expect(ops).toHaveLength(2)
  })

  it('returns empty for unparseable output', () => {
    expect(parseFileOperations('just text', {})).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Implement parser**

```typescript
// packages/ai-engine/src/parser.ts
import type { FileMap, FileOperation } from '@buildn/shared'

const FILE_RE = /---FILE:\s*(.+?)---\n([\s\S]*?)---END FILE---/g

function stripMarkdownFences(content: string): string {
  // Remove leading ```lang and trailing ``` if the entire content is wrapped
  const trimmed = content.trim()
  const fenceMatch = trimmed.match(/^```\w*\n([\s\S]*?)\n?```$/)
  if (fenceMatch) return fenceMatch[1].trimEnd()
  return trimmed
}

export function parseFileOperations(llmOutput: string, existingFiles: FileMap): FileOperation[] {
  const operations: FileOperation[] = []
  FILE_RE.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = FILE_RE.exec(llmOutput)) !== null) {
    const path = match[1].trim()
    const content = stripMarkdownFences(match[2])
    operations.push({
      type: path in existingFiles ? 'modify' : 'create',
      path,
      content,
    })
  }

  return operations
}
```

- [ ] **Step 3: Run tests**

Run: `cd packages/ai-engine && pnpm test`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add packages/ai-engine/
git commit -m "feat(ai-engine): add output parser with markdown fence stripping and tests"
```

---

## Task 8: Post-Processing (TypeCheck + Auto-Fix)

**Files:**
- Create: `packages/ai-engine/src/postprocess.ts`

- [ ] **Step 1: Create postprocess.ts**

```typescript
// packages/ai-engine/src/postprocess.ts
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

  // Auto-fix loop
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

  // Return last attempt even if not perfect
  return currentOps
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
cd packages/ai-engine && pnpm typecheck
git add packages/ai-engine/src/postprocess.ts
git commit -m "feat(ai-engine): add post-processing with typecheck and auto-fix"
```

---

## Task 9: Main Pipeline

**Files:**
- Create: `packages/ai-engine/src/pipeline.ts`
- Modify: `packages/ai-engine/src/index.ts`

- [ ] **Step 1: Create pipeline.ts**

```typescript
// packages/ai-engine/src/pipeline.ts
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
    // For questions or unparseable output, just send done with no ops
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
```

- [ ] **Step 2: Update index.ts**

```typescript
// packages/ai-engine/src/index.ts
export { generateCode } from './pipeline'
export { classifyIntent } from './classifier'
export { parseFileOperations } from './parser'
```

- [ ] **Step 3: Typecheck**

Run: `cd packages/ai-engine && pnpm typecheck`

- [ ] **Step 4: Run all tests**

Run: `cd packages/ai-engine && pnpm test`

- [ ] **Step 5: Commit**

```bash
git add packages/ai-engine/
git commit -m "feat(ai-engine): implement main pipeline orchestrator"
```

---

## Task 10: Chat SSE Endpoint

**Files:**
- Create: `apps/web/app/api/chat/route.ts`
- Modify: `apps/web/package.json` (add @buildn/ai-engine dep)

- [ ] **Step 1: Add ai-engine dependency**

Add to `apps/web/package.json` dependencies:
```json
"@buildn/ai-engine": "workspace:*"
```

- [ ] **Step 2: Create SSE chat endpoint**

`apps/web/app/api/chat/route.ts`:
```typescript
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateCode } from '@buildn/ai-engine'
import type { GenerateEvent, FileOperation, ConversationMessage } from '@buildn/shared'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { projectId, prompt } = await request.json() as { projectId: string; prompt: string }
  if (!projectId || !prompt) return new Response('Missing projectId or prompt', { status: 400 })

  // Verify project ownership (RLS handles this but check anyway)
  const { data: project } = await supabase.from('projects').select('id').eq('id', projectId).single()
  if (!project) return new Response('Project not found', { status: 404 })

  // Load project files
  const { data: fileRows } = await supabase.from('files').select('path, content').eq('project_id', projectId)
  const projectFiles: Record<string, string> = {}
  for (const row of fileRows ?? []) {
    projectFiles[row.path] = row.content
  }

  // Load conversation history (last 20)
  const { data: messageRows } = await supabase
    .from('messages')
    .select('role, content')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(20)
  const conversationHistory: ConversationMessage[] = (messageRows ?? []).reverse().map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  // Save user message
  await supabase.from('messages').insert({ project_id: projectId, role: 'user', content: prompt })

  // Stream SSE
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let fullContent = ''
      const allFileOps: FileOperation[] = []

      await generateCode(
        { prompt, projectFiles, conversationHistory },
        (event: GenerateEvent) => {
          if (event.type === 'token') fullContent += event.text
          if (event.type === 'file_operation') allFileOps.push(event.operation)

          controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`))

          if (event.type === 'done') {
            // Save assistant message + apply file operations
            saveResult(supabase, projectId, fullContent, allFileOps).catch(console.error)
          }
        },
      )

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

async function saveResult(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  content: string,
  fileOps: FileOperation[],
) {
  // Save assistant message
  const { data: msg } = await supabase
    .from('messages')
    .insert({ project_id: projectId, role: 'assistant', content, file_ops: fileOps })
    .select('id')
    .single()

  // Apply file operations
  for (const op of fileOps) {
    if (op.type === 'delete') {
      await supabase.from('files').delete().eq('project_id', projectId).eq('path', op.path)
    } else if (op.content) {
      await supabase.from('files').upsert(
        { project_id: projectId, path: op.path, content: op.content, updated_at: new Date().toISOString() },
        { onConflict: 'project_id,path' },
      )
    }
  }

  // Save snapshot
  const { data: allFiles } = await supabase.from('files').select('path, content').eq('project_id', projectId)
  const fileMap: Record<string, string> = {}
  for (const f of allFiles ?? []) fileMap[f.path] = f.content

  await supabase.from('snapshots').insert({
    project_id: projectId,
    message_id: msg?.id,
    description: `AI: ${fileOps.length} file(s) changed`,
    files: fileMap,
  })
}
```

- [ ] **Step 3: Install, typecheck, build**

```bash
cd /Users/allen/AllenProject/buildn-app && pnpm install
cd apps/web && pnpm typecheck && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/ packages/ai-engine/
git commit -m "feat: add chat SSE endpoint connecting AI engine to Next.js API"
```

---

## Task 11: Full Verification

- [ ] **Step 1: Typecheck all**

```bash
pnpm typecheck
```

- [ ] **Step 2: Run AI engine tests**

```bash
cd packages/ai-engine && pnpm test
```

- [ ] **Step 3: Build**

```bash
pnpm build
```

- [ ] **Step 4: Commit and push**

```bash
git add -A && git diff --cached --quiet || git commit -m "chore: final P1 verification"
git push origin main
```
