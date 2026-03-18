# Plan 6: End-to-End Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the full user flow: user types a prompt → backend calls AI engine → streams response to frontend → frontend syncs files to WebContainer → preview updates live.

**Architecture:** Frontend sends message via SSE to backend chat endpoint. Backend orchestrates AI engine and streams events. Frontend consumes events, updates Zustand store, writes files to WebContainer sandbox. Vite HMR auto-refreshes the preview iframe.

**Tech Stack:** All existing (no new dependencies)

---

## File Structure

Changes are primarily in existing files:

```
packages/web/src/
├── lib/
│   └── chat-stream.ts               # SSE event consumer
├── hooks/
│   └── use-chat.ts                  # Chat hook connecting store + API + sandbox
├── pages/
│   └── Workspace.tsx                # (modify: wire everything together)
packages/server/src/
├── app.ts                           # (modify: add Vite proxy for dev)
```

---

## Task 1: SSE Stream Consumer

**Files:**
- Create: `packages/web/src/lib/chat-stream.ts`

- [ ] **Step 1: Create chat-stream.ts**

```typescript
import type { GenerateEvent } from '@buildn/shared'

export async function* consumeSSE(
  response: Response,
): AsyncGenerator<GenerateEvent> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (line.startsWith('data:')) {
        const data = line.slice(5).trim()
        if (data) {
          try {
            yield JSON.parse(data) as GenerateEvent
          } catch {
            // Skip unparseable lines
          }
        }
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/lib/chat-stream.ts
git commit -m "feat(web): add SSE stream consumer for chat events"
```

---

## Task 2: Chat Hook

**Files:**
- Create: `packages/web/src/hooks/use-chat.ts`

- [ ] **Step 1: Create use-chat.ts**

```typescript
import { useCallback } from 'react'
import { useAppStore } from '../stores/app-store'
import { api } from '../lib/api'
import { consumeSSE } from '../lib/chat-stream'
import { getSandbox, writeFilesToSandbox } from '../lib/sandbox'
import type { FileOperation } from '@buildn/shared'

export function useChat() {
  const store = useAppStore()

  const sendMessage = useCallback(async (prompt: string) => {
    const projectId = store.projectId
    if (!projectId || store.isGenerating) return

    // Add user message
    store.addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
      status: 'done',
      createdAt: new Date(),
    })

    // Add placeholder assistant message
    const assistantId = crypto.randomUUID()
    store.addMessage({
      id: assistantId,
      role: 'assistant',
      content: '',
      status: 'streaming',
      createdAt: new Date(),
    })

    store.setIsGenerating(true)

    try {
      const response = await api.streamChat(projectId, prompt)
      if (!response.ok) throw new Error(`Chat failed: ${response.status}`)

      const fileOps: FileOperation[] = []

      for await (const event of consumeSSE(response)) {
        switch (event.type) {
          case 'token':
            store.updateLastAssistant({
              content: store.messages.findLast((m) => m.role === 'assistant')?.content + event.text,
            })
            break

          case 'file_operation':
            fileOps.push(event.operation)
            store.updateLastAssistant({ fileOperations: [...fileOps] })
            break

          case 'done':
            store.updateLastAssistant({ status: 'done' })
            store.applyFileOperations(event.operations)

            // Sync to WebContainer
            const wc = getSandbox()
            if (wc) {
              const newFiles: Record<string, string> = {}
              for (const op of event.operations) {
                if (op.type !== 'delete' && op.content) {
                  newFiles[op.path] = op.content
                }
              }
              await writeFilesToSandbox(wc, newFiles)
            }
            break

          case 'error':
            store.updateLastAssistant({ status: 'error', content: event.error.message })
            break
        }
      }
    } catch (err) {
      store.updateLastAssistant({
        status: 'error',
        content: `Error: ${err instanceof Error ? err.message : String(err)}`,
      })
    } finally {
      store.setIsGenerating(false)
    }
  }, [store])

  return { sendMessage }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/hooks/
git commit -m "feat(web): add useChat hook connecting store, API, and sandbox"
```

---

## Task 3: Workspace Page Wiring

**Files:**
- Modify: `packages/web/src/pages/Workspace.tsx`

- [ ] **Step 1: Wire Workspace to connect all components**

The Workspace page should:
1. Load project from API on mount (`api.getProject(id)`)
2. Boot WebContainer with project files
3. Install deps and start dev server
4. Render AppShell with FileTree, ChatPanel (via useChat), CodeEditor, PreviewPanel
5. Connect all store state to component props

- [ ] **Step 2: Typecheck and commit**

```bash
git add packages/web/src/pages/Workspace.tsx
git commit -m "feat(web): wire Workspace page with full chat-to-preview flow"
```

---

## Task 4: Vite Dev Proxy

**Files:**
- Modify: `packages/web/vite.config.ts`

- [ ] **Step 1: Add proxy for API calls during development**

```typescript
// Add to vite.config.ts defineConfig
server: {
  port: 5173,
  headers: {
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin',
  },
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true,
    },
  },
},
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/vite.config.ts
git commit -m "feat(web): add API proxy to Vite dev server"
```

---

## Task 5: Full E2E Verification

- [ ] **Step 1: Typecheck all packages**

Run: `pnpm typecheck`

- [ ] **Step 2: Build all packages**

Run: `pnpm build`

- [ ] **Step 3: Lint all packages**

Run: `pnpm lint`

- [ ] **Step 4: Manual smoke test**

In two terminals:
```bash
# Terminal 1: Start backend
cd packages/server && pnpm dev

# Terminal 2: Start frontend
cd packages/web && pnpm dev
```

Verify:
- Frontend loads at http://localhost:5173
- Login page renders
- API proxy works (health check via browser)

- [ ] **Step 5: Final commit**

```bash
git add -A
git diff --cached --quiet || git commit -m "chore: final integration fixes and cleanup"
```
