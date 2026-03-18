# Plan 1: Foundation — Monorepo Scaffolding & Shared Types

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the monorepo infrastructure so all four packages (web, server, ai-engine, shared) can build, lint, and share types.

**Architecture:** pnpm workspace monorepo with Turborepo for orchestrated builds. A `shared` package exports common TypeScript types consumed by the other three packages. Each package has its own `tsconfig.json` extending a root base config.

**Tech Stack:** pnpm 9, Turborepo, TypeScript 5.7 (strict), React 19, Vite 6, Tailwind CSS 4, Hono, ESLint 9, Prettier, GitHub Actions

---

## File Structure

```
buildn-app/
├── package.json                    # Root: workspaces, devDependencies, scripts
├── pnpm-workspace.yaml             # Workspace definition
├── turbo.json                      # Turborepo pipeline config
├── tsconfig.base.json              # Shared TS base config
├── .prettierrc                     # Prettier config
├── eslint.config.mjs               # ESLint flat config (root)
├── .env.example                    # Environment variable template
├── .github/
│   └── workflows/
│       └── ci.yml                  # GitHub Actions CI
├── packages/
│   ├── shared/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts            # Re-export all types
│   │       └── types/
│   │           ├── file.ts         # FileMap, FileOperation, FileTreeNode
│   │           ├── chat.ts         # ConversationMessage, ChatMessage
│   │           ├── project.ts      # Project, User, Snapshot
│   │           ├── ai-engine.ts    # GenerateRequest, GenerateEvent, EngineError
│   │           └── sandbox.ts      # SandboxStatus, SandboxError, InstallResult, BuildResult
│   ├── web/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       └── styles/
│   │           └── globals.css     # Tailwind directives
│   ├── server/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts            # Hono hello-world server
│   └── ai-engine/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── index.ts            # Placeholder export
```

---

## Task 1: Root Monorepo Setup

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`

- [ ] **Step 1: Initialize root package.json**

```json
{
  "name": "buildn-app",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "turbo typecheck"
  },
  "devDependencies": {
    "turbo": "^2",
    "typescript": "^5.7",
    "prettier": "^3",
    "eslint": "^9",
    "@typescript-eslint/eslint-plugin": "^8",
    "@typescript-eslint/parser": "^8"
  },
  "packageManager": "pnpm@9.15.4"
}
```

- [ ] **Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - 'packages/*'
```

- [ ] **Step 3: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

- [ ] **Step 4: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 5: Install dependencies and verify**

Run: `pnpm install`
Expected: lockfile generated, no errors

Run: `pnpm turbo build`
Expected: 0 tasks (no packages yet), no errors

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json tsconfig.base.json pnpm-lock.yaml
git commit -m "chore: initialize monorepo with pnpm workspace and turborepo"
```

---

## Task 2: Shared Types Package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types/file.ts`
- Create: `packages/shared/src/types/chat.ts`
- Create: `packages/shared/src/types/project.ts`
- Create: `packages/shared/src/types/ai-engine.ts`
- Create: `packages/shared/src/types/sandbox.ts`

- [ ] **Step 1: Create packages/shared/package.json**

```json
{
  "name": "@buildn/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts"
    }
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/"
  },
  "devDependencies": {
    "typescript": "^5.7"
  }
}
```

- [ ] **Step 2: Create packages/shared/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create packages/shared/src/types/file.ts**

```typescript
/** Map of file paths to file contents */
export type FileMap = Record<string, string>

export interface FileOperation {
  type: 'create' | 'modify' | 'delete'
  path: string
  content?: string
  diff?: string
}

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}
```

- [ ] **Step 4: Create packages/shared/src/types/chat.ts**

```typescript
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
```

- [ ] **Step 5: Create packages/shared/src/types/project.ts**

```typescript
export interface User {
  id: string
  email: string
  name: string
  plan: 'free' | 'pro' | 'team'
  createdAt: Date
}

export interface Project {
  id: string
  userId: string
  name: string
  description: string
  template: 'blank' | 'dashboard' | 'landing' | 'ecommerce'
  status: 'draft' | 'published'
  deployUrl: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ProjectSummary {
  id: string
  name: string
  description: string
  status: 'draft' | 'published'
  deployUrl: string | null
  updatedAt: Date
}

export interface Snapshot {
  id: string
  projectId: string
  messageId: string | null
  description: string
  files: Record<string, string>
  createdAt: Date
}

export interface SnapshotSummary {
  id: string
  messageId: string
  description: string
  fileCount: number
  createdAt: Date
}
```

- [ ] **Step 6: Create packages/shared/src/types/ai-engine.ts**

```typescript
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
```

- [ ] **Step 7: Create packages/shared/src/types/sandbox.ts**

```typescript
export type SandboxStatus =
  | 'idle'
  | 'booting'
  | 'installing'
  | 'running'
  | 'building'
  | 'error'

export interface InstallResult {
  success: boolean
  duration: number
  installedPackages?: string[]
  errors?: string[]
}

export interface BuildResult {
  success: boolean
  outputFiles: string[]
  errors?: string[]
  warnings?: string[]
}

export interface SandboxError {
  code: 'BOOT_FAILED' | 'INSTALL_FAILED' | 'SERVER_CRASH' | 'BUILD_FAILED' | 'FS_ERROR'
  message: string
  details?: string
}
```

- [ ] **Step 8: Create packages/shared/src/index.ts**

```typescript
export type { FileMap, FileOperation, FileTreeNode } from './types/file'
export type { ConversationMessage, ChatMessage } from './types/chat'
export type {
  User,
  Project,
  ProjectSummary,
  Snapshot,
  SnapshotSummary,
} from './types/project'
export type {
  Intent,
  GenerateRequest,
  GenerateConfig,
  GenerateEvent,
  ValidationResult,
  EngineError,
} from './types/ai-engine'
export type {
  SandboxStatus,
  InstallResult,
  BuildResult,
  SandboxError,
} from './types/sandbox'
```

- [ ] **Step 9: Verify types compile**

Run: `cd packages/shared && pnpm typecheck`
Expected: No errors

- [ ] **Step 10: Commit**

```bash
git add packages/shared/
git commit -m "feat: add shared types package with all module interfaces"
```

---

## Task 3: Web Package Scaffolding

**Files:**
- Create: `packages/web/package.json`
- Create: `packages/web/tsconfig.json`
- Create: `packages/web/vite.config.ts`
- Create: `packages/web/index.html`
- Create: `packages/web/src/main.tsx`
- Create: `packages/web/src/App.tsx`
- Create: `packages/web/src/styles/globals.css`

- [ ] **Step 1: Create packages/web/package.json**

```json
{
  "name": "@buildn/web",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/"
  },
  "dependencies": {
    "react": "^19",
    "react-dom": "^19"
  },
  "devDependencies": {
    "@buildn/shared": "workspace:*",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^4",
    "tailwindcss": "^4",
    "@tailwindcss/vite": "^4",
    "typescript": "^5.7",
    "vite": "^6"
  }
}
```

- [ ] **Step 2: Create packages/web/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "dist",
    "rootDir": "src",
    "noEmit": true
  },
  "include": ["src"],
  "references": [
    { "path": "../shared" }
  ]
}
```

- [ ] **Step 3: Create packages/web/vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
})
```

Note: The COEP/COOP headers are required for WebContainer API to work (SharedArrayBuffer).

- [ ] **Step 4: Create packages/web/index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Buildn</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create packages/web/src/styles/globals.css**

```css
@import 'tailwindcss';
```

- [ ] **Step 6: Create packages/web/src/main.tsx**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 7: Create packages/web/src/App.tsx**

```tsx
export function App() {
  return (
    <div className="flex h-screen items-center justify-center bg-neutral-950 text-white">
      <h1 className="text-4xl font-bold">造 Buildn</h1>
    </div>
  )
}
```

- [ ] **Step 8: Install dependencies and verify**

Run: `pnpm install`

Run: `cd packages/web && pnpm typecheck`
Expected: No errors

Run: `cd packages/web && pnpm build`
Expected: Build succeeds, dist/ directory created

- [ ] **Step 9: Commit**

```bash
git add packages/web/
git commit -m "feat: scaffold web package with React 19, Vite 6, Tailwind CSS 4"
```

---

## Task 4: Server Package Scaffolding

**Files:**
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/server/src/index.ts`

- [ ] **Step 1: Create packages/server/package.json**

```json
{
  "name": "@buildn/server",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/"
  },
  "dependencies": {
    "hono": "^4",
    "@hono/node-server": "^1"
  },
  "devDependencies": {
    "@buildn/shared": "workspace:*",
    "tsx": "^4",
    "typescript": "^5.7"
  }
}
```

- [ ] **Step 2: Create packages/server/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "references": [
    { "path": "../shared" }
  ]
}
```

- [ ] **Step 3: Create packages/server/src/index.ts**

```typescript
import { serve } from '@hono/node-server'
import { Hono } from 'hono'

const app = new Hono()

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

const port = Number(process.env.PORT) || 3001

serve({ fetch: app.fetch, port }, () => {
  console.log(`Buildn API server running on http://localhost:${port}`)
})

export { app }
```

- [ ] **Step 4: Install dependencies and verify**

Run: `pnpm install`

Run: `cd packages/server && pnpm typecheck`
Expected: No errors

Run: `cd packages/server && pnpm build`
Expected: Build succeeds, dist/ directory created

- [ ] **Step 5: Commit**

```bash
git add packages/server/
git commit -m "feat: scaffold server package with Hono"
```

---

## Task 5: AI Engine Package Scaffolding

**Files:**
- Create: `packages/ai-engine/package.json`
- Create: `packages/ai-engine/tsconfig.json`
- Create: `packages/ai-engine/src/index.ts`

- [ ] **Step 1: Create packages/ai-engine/package.json**

```json
{
  "name": "@buildn/ai-engine",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39"
  },
  "devDependencies": {
    "@buildn/shared": "workspace:*",
    "typescript": "^5.7"
  }
}
```

- [ ] **Step 2: Create packages/ai-engine/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "references": [
    { "path": "../shared" }
  ]
}
```

- [ ] **Step 3: Create packages/ai-engine/src/index.ts**

```typescript
import type { GenerateRequest, GenerateEvent } from '@buildn/shared'

export async function* generateCode(
  request: GenerateRequest,
): AsyncGenerator<GenerateEvent> {
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
```

- [ ] **Step 4: Install dependencies and verify**

Run: `pnpm install`

Run: `cd packages/ai-engine && pnpm typecheck`
Expected: No errors

Run: `cd packages/ai-engine && pnpm build`
Expected: Build succeeds, dist/ directory created

- [ ] **Step 5: Commit**

```bash
git add packages/ai-engine/
git commit -m "feat: scaffold ai-engine package with placeholder generateCode"
```

---

## Task 6: ESLint + Prettier Configuration

**Files:**
- Create: `eslint.config.mjs`
- Create: `.prettierrc`
- Create: `.prettierignore`

- [ ] **Step 1: Create .prettierrc**

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100
}
```

- [ ] **Step 2: Create .prettierignore**

```
dist
node_modules
pnpm-lock.yaml
```

- [ ] **Step 3: Create eslint.config.mjs**

```javascript
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
]
```

- [ ] **Step 4: Verify lint and format**

Run: `pnpm format:check`
Expected: All files formatted (or shows which need formatting)

Run: `pnpm format`
Expected: Files formatted

Run: `pnpm lint`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add eslint.config.mjs .prettierrc .prettierignore
git commit -m "chore: add ESLint and Prettier configuration"
```

---

## Task 7: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create .github/workflows/ci.yml**

```yaml
name: CI

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main, dev]

jobs:
  check:
    name: Typecheck, Lint, Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - run: pnpm format:check

      - run: pnpm typecheck

      - run: pnpm lint

      - run: pnpm build
```

- [ ] **Step 2: Verify CI config is valid YAML**

Run: `node -e "const fs = require('fs'); const y = require('yaml'); y.parse(fs.readFileSync('.github/workflows/ci.yml', 'utf8')); console.log('Valid YAML');" 2>/dev/null || echo "Verify manually"`

- [ ] **Step 3: Commit**

```bash
git add .github/
git commit -m "ci: add GitHub Actions workflow for typecheck, lint, build"
```

---

## Task 8: Environment Variables Template

**Files:**
- Create: `.env.example`

- [ ] **Step 1: Create .env.example**

```env
# AI
ANTHROPIC_API_KEY=sk-ant-xxx

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/buildn

# Redis
REDIS_URL=redis://localhost:6379

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx

# Deploy
NETLIFY_AUTH_TOKEN=xxx

# Server
PORT=3001
```

- [ ] **Step 2: Verify .gitignore excludes .env**

Run: `grep '\.env' .gitignore`
Expected: `.env` or `.env*` pattern exists (already in the initial .gitignore)

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore: add environment variables template"
```

---

## Task 9: Full Build Verification

- [ ] **Step 1: Clean install from scratch**

Run: `rm -rf node_modules packages/*/node_modules packages/*/dist`
Run: `pnpm install`
Expected: Clean install, no errors

- [ ] **Step 2: Run full pipeline**

Run: `pnpm typecheck`
Expected: All 4 packages pass type checking

Run: `pnpm lint`
Expected: No lint errors

Run: `pnpm build`
Expected: All packages build successfully

Run: `pnpm format:check`
Expected: All files formatted

- [ ] **Step 3: Smoke test dev servers**

Run: `cd packages/server && timeout 5 pnpm dev || true`
Expected: "Buildn API server running on http://localhost:3001" in output

- [ ] **Step 4: Final commit if any formatting changes**

```bash
git add -A
git status
# Only commit if there are changes
git diff --cached --quiet || git commit -m "chore: format all files"
```
