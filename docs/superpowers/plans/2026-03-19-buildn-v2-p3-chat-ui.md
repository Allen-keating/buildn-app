# Buildn V2 P3: Chat UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the conversational chat interface to the Workspace — users type prompts, AI streams responses with Markdown, file changes sync to WebContainer for live preview updates.

**Architecture:** A chat Zustand store manages messages and streaming state. An SSE client consumes `/api/chat` events. Chat components (MessageList, MessageBubble, ChatInput) render in the Workspace center panel. On `done` event, file operations are synced to the WebContainer sandbox (from P2) via `writeFilesToContainer`. The center panel switches between Chat and Code tabs (Code tab is a placeholder for P4).

**Tech Stack:** Zustand, react-markdown, remark-gfm, SSE fetch streaming, @buildn/sandbox (writeFilesToContainer)

---

## File Structure

```
apps/web/
├── lib/
│   ├── stores/
│   │   └── chat-store.ts              # Chat Zustand store (messages, streaming state)
│   └── chat/
│       └── sse-client.ts              # SSE stream consumer for /api/chat
├── components/
│   └── chat/
│       ├── chat-panel.tsx             # Container: MessageList + ChatInput
│       ├── message-list.tsx           # Scrollable message list with auto-scroll
│       ├── message-bubble.tsx         # Single message (user or assistant with Markdown)
│       └── chat-input.tsx             # Textarea + send button
├── components/dashboard/
│   └── workspace-shell.tsx            # Modify: replace center panel placeholder
└── package.json                       # Modify: add react-markdown, remark-gfm
```

---

## Task 1: Dependencies

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add markdown rendering dependencies**

```bash
cd apps/web && pnpm add react-markdown remark-gfm
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add react-markdown and remark-gfm"
```

---

## Task 2: Chat Store

**Files:**
- Create: `apps/web/lib/stores/chat-store.ts`

- [ ] **Step 1: Create chat-store.ts**

```typescript
'use client'

import { create } from 'zustand'
import type { FileOperation } from '@buildn/shared'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  fileOperations?: FileOperation[]
  status: 'pending' | 'streaming' | 'done' | 'error'
}

interface ChatStore {
  messages: ChatMessage[]
  isGenerating: boolean

  addUserMessage: (content: string) => string
  addAssistantPlaceholder: () => string
  appendToAssistant: (text: string) => void
  setAssistantFileOps: (ops: FileOperation[]) => void
  finalizeAssistant: (status: 'done' | 'error') => void
  setIsGenerating: (v: boolean) => void
  reset: () => void
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isGenerating: false,

  addUserMessage: (content) => {
    const id = crypto.randomUUID()
    set((s) => ({
      messages: [...s.messages, { id, role: 'user', content, status: 'done' }],
    }))
    return id
  },

  addAssistantPlaceholder: () => {
    const id = crypto.randomUUID()
    set((s) => ({
      messages: [...s.messages, { id, role: 'assistant', content: '', status: 'streaming' }],
    }))
    return id
  },

  appendToAssistant: (text) =>
    set((s) => {
      const msgs = [...s.messages]
      const last = findLastAssistant(msgs)
      if (last) last.content += text
      return { messages: msgs }
    }),

  setAssistantFileOps: (ops) =>
    set((s) => {
      const msgs = [...s.messages]
      const last = findLastAssistant(msgs)
      if (last) last.fileOperations = [...(last.fileOperations ?? []), ...ops]
      return { messages: msgs }
    }),

  finalizeAssistant: (status) =>
    set((s) => {
      const msgs = [...s.messages]
      const last = findLastAssistant(msgs)
      if (last) last.status = status
      return { messages: msgs }
    }),

  setIsGenerating: (v) => set({ isGenerating: v }),
  reset: () => set({ messages: [], isGenerating: false }),
}))

function findLastAssistant(msgs: ChatMessage[]): ChatMessage | undefined {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === 'assistant') return msgs[i]
  }
  return undefined
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/stores/chat-store.ts
git commit -m "feat(web): add chat Zustand store"
```

---

## Task 3: SSE Client

**Files:**
- Create: `apps/web/lib/chat/sse-client.ts`

- [ ] **Step 1: Create sse-client.ts**

```typescript
import type { GenerateEvent, FileOperation } from '@buildn/shared'

export interface SSECallbacks {
  onToken: (text: string) => void
  onFileOperation: (op: FileOperation) => void
  onDone: (operations: FileOperation[]) => void
  onError: (error: { code: string; message: string }) => void
  onIntent?: (intent: string) => void
}

export async function streamChat(
  projectId: string,
  prompt: string,
  callbacks: SSECallbacks,
): Promise<void> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, prompt }),
  })

  if (!res.ok) {
    const text = await res.text()
    callbacks.onError({ code: 'HTTP_ERROR', message: text || `HTTP ${res.status}` })
    return
  }

  const reader = res.body?.getReader()
  if (!reader) {
    callbacks.onError({ code: 'NO_BODY', message: 'No response body' })
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    while (buffer.includes('\n')) {
      const idx = buffer.indexOf('\n')
      const line = buffer.slice(0, idx).trim()
      buffer = buffer.slice(idx + 1)

      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (!data) continue

      try {
        const event = JSON.parse(data) as GenerateEvent

        switch (event.type) {
          case 'token':
            callbacks.onToken(event.text)
            break
          case 'file_operation':
            callbacks.onFileOperation(event.operation)
            break
          case 'done':
            callbacks.onDone(event.operations)
            break
          case 'error':
            callbacks.onError(event.error)
            break
          case 'intent':
            callbacks.onIntent?.(event.intent)
            break
        }
      } catch {
        // skip unparseable
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/chat/
git commit -m "feat(web): add SSE client for /api/chat"
```

---

## Task 4: Chat Components

**Files:**
- Create: `apps/web/components/chat/chat-input.tsx`
- Create: `apps/web/components/chat/message-bubble.tsx`
- Create: `apps/web/components/chat/message-list.tsx`
- Create: `apps/web/components/chat/chat-panel.tsx`

- [ ] **Step 1: Create chat-input.tsx**

```tsx
'use client'

import { useState, useRef, type KeyboardEvent } from 'react'

interface ChatInputProps {
  onSubmit: (text: string) => void
  disabled: boolean
}

export function ChatInput({ onSubmit, disabled }: ChatInputProps) {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  function handleSubmit() {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSubmit(trimmed)
    setText('')
    ref.current?.focus()
  }

  return (
    <div className="border-t border-neutral-800 p-3">
      <div className="flex gap-2">
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Describe what you want to build..."
          rows={2}
          className="flex-1 resize-none rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !text.trim()}
          className="self-end rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create message-bubble.tsx**

```tsx
'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from '@/lib/stores/chat-store'

interface MessageBubbleProps {
  message: ChatMessage
  onFileClick?: (path: string) => void
}

export function MessageBubble({ message, onFileClick }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-neutral-800 text-neutral-100'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <>
            <div className="prose prose-invert prose-sm max-w-none [&_pre]:bg-neutral-900 [&_pre]:border [&_pre]:border-neutral-700 [&_code]:text-blue-300">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content || ' '}
              </ReactMarkdown>
            </div>
            {message.status === 'streaming' && (
              <span className="ml-0.5 inline-block h-4 w-1 animate-pulse bg-blue-400" />
            )}
          </>
        )}

        {message.fileOperations && message.fileOperations.length > 0 && (
          <div className="mt-2 border-t border-neutral-700 pt-2">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
              Files changed
            </p>
            {message.fileOperations.map((op) => (
              <button
                key={op.path}
                onClick={() => onFileClick?.(op.path)}
                className="block text-xs text-blue-400 hover:underline"
              >
                {op.type === 'create' ? '+ ' : op.type === 'delete' ? '- ' : '~ '}
                {op.path}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create message-list.tsx**

```tsx
'use client'

import { useEffect, useRef } from 'react'
import type { ChatMessage } from '@/lib/stores/chat-store'
import { MessageBubble } from './message-bubble'

interface MessageListProps {
  messages: ChatMessage[]
  onFileClick?: (path: string) => void
}

export function MessageList({ messages, onFileClick }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-neutral-500">
        <p className="text-lg font-medium">What do you want to build?</p>
        <p className="text-sm">Describe your app and Buildn will create it for you.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-4">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} onFileClick={onFileClick} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
```

- [ ] **Step 4: Create chat-panel.tsx**

This is the main component that wires store + SSE + sandbox together.

```tsx
'use client'

import { useCallback } from 'react'
import { useChatStore } from '@/lib/stores/chat-store'
import { streamChat } from '@/lib/chat/sse-client'
import { getSandbox, writeFilesToContainer, hasPackageJsonChanged, installDeps } from '@buildn/sandbox'
import { MessageList } from './message-list'
import { ChatInput } from './chat-input'
import type { FileMap } from '@buildn/shared'

interface ChatPanelProps {
  projectId: string
  currentFiles: FileMap
  onFilesChanged?: (files: FileMap) => void
}

export function ChatPanel({ projectId, currentFiles, onFilesChanged }: ChatPanelProps) {
  const { messages, isGenerating, addUserMessage, addAssistantPlaceholder, appendToAssistant, setAssistantFileOps, finalizeAssistant, setIsGenerating } = useChatStore()

  const handleSend = useCallback(async (prompt: string) => {
    if (isGenerating) return

    addUserMessage(prompt)
    addAssistantPlaceholder()
    setIsGenerating(true)

    const filesBefore = { ...currentFiles }

    try {
      await streamChat(projectId, prompt, {
        onToken: (text) => appendToAssistant(text),
        onFileOperation: (op) => setAssistantFileOps([op]),
        onDone: async (operations) => {
          finalizeAssistant('done')

          // Apply file operations to local state
          const updatedFiles = { ...currentFiles }
          for (const op of operations) {
            if (op.type === 'delete') delete updatedFiles[op.path]
            else if (op.content) updatedFiles[op.path] = op.content
          }
          onFilesChanged?.(updatedFiles)

          // Sync to WebContainer
          const wc = getSandbox()
          if (wc && operations.length > 0) {
            const newFileMap: Record<string, string> = {}
            for (const op of operations) {
              if (op.type !== 'delete' && op.content) {
                newFileMap[op.path] = op.content
              }
            }
            await writeFilesToContainer(wc, newFileMap)

            // If package.json changed, reinstall deps
            if (hasPackageJsonChanged(filesBefore, updatedFiles)) {
              await installDeps(wc)
            }
          }
        },
        onError: (error) => {
          appendToAssistant(`\n\nError: ${error.message}`)
          finalizeAssistant('error')
        },
      })
    } catch (err) {
      appendToAssistant(`\n\nError: ${err instanceof Error ? err.message : String(err)}`)
      finalizeAssistant('error')
    } finally {
      setIsGenerating(false)
    }
  }, [projectId, currentFiles, isGenerating, addUserMessage, addAssistantPlaceholder, appendToAssistant, setAssistantFileOps, finalizeAssistant, setIsGenerating, onFilesChanged])

  return (
    <div className="flex h-full flex-col">
      <MessageList messages={messages} />
      <ChatInput onSubmit={handleSend} disabled={isGenerating} />
    </div>
  )
}
```

- [ ] **Step 5: Typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/chat/
git commit -m "feat(web): add chat components (input, messages, panel with SSE + sandbox sync)"
```

---

## Task 5: Wire Chat into Workspace

**Files:**
- Modify: `apps/web/components/dashboard/workspace-shell.tsx`

- [ ] **Step 1: Update workspace-shell.tsx**

Replace the center panel content. Add a `useState` for `files` so the ChatPanel can update it. Add tab switching between Chat and Code (Code is still placeholder).

The key changes:
1. Add `const [files, setFiles] = useState<FileMap>(initialFiles)` state
2. Add `const [activeTab, setActiveTab] = useState<'chat' | 'code'>('chat')` state
3. Replace "Coming in P3" with `<ChatPanel>` when chat tab is active
4. Pass `files` to `bootSandbox` in useEffect (change dependency from `initialFiles` to `files` for sandbox reboot when files change — actually keep `initialFiles` for boot, files updates go through writeFilesToContainer)
5. Update file count in status bar to use `files` state

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Group, Panel, Separator } from 'react-resizable-panels'
import type { Project, FileMap } from '@buildn/shared'
import { bootSandbox, installDeps, startDevServer, teardownSandbox } from '@buildn/sandbox'
import { useSandboxStore } from '@/lib/stores/sandbox-store'
import { PreviewPanel } from '@/components/preview/preview-panel'
import { ChatPanel } from '@/components/chat/chat-panel'

interface WorkspaceShellProps {
  project: Project
  initialFiles: FileMap
}

export function WorkspaceShell({ project, initialFiles }: WorkspaceShellProps) {
  const { setStatus, setPreviewUrl, setError, reset } = useSandboxStore()
  const [files, setFiles] = useState<FileMap>(initialFiles)
  const [activeTab, setActiveTab] = useState<'chat' | 'code'>('chat')

  useEffect(() => {
    if (Object.keys(initialFiles).length === 0) return

    let cancelled = false

    async function boot() {
      try {
        setStatus('booting')
        const wc = await bootSandbox(initialFiles)
        if (cancelled) return

        setStatus('installing')
        const exitCode = await installDeps(wc)
        if (cancelled) return
        if (exitCode !== 0) { setError('Failed to install dependencies'); return }

        setStatus('running')
        await startDevServer(wc, (url) => setPreviewUrl(url), (err) => setError(err))
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to start sandbox')
      }
    }

    boot()
    return () => { cancelled = true; reset(); teardownSandbox().catch(() => {}) }
  }, [initialFiles, setStatus, setPreviewUrl, setError, reset])

  return (
    <div className="flex h-screen flex-col bg-neutral-950 text-white">
      <div className="flex h-11 items-center justify-between border-b border-neutral-800 px-4">
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="font-bold">造</Link>
          <span className="text-neutral-600">/</span>
          <span className="text-sm text-neutral-400">{project.name}</span>
        </div>
        <div className="flex gap-2">
          <button className="rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-400 hover:text-white">Share</button>
          <button className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-500">Publish</button>
        </div>
      </div>

      <Group orientation="horizontal" className="flex-1">
        <Panel defaultSize={15} minSize={10} maxSize={25}>
          <div className="flex h-full flex-col border-r border-neutral-800">
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">Files</div>
            <div className="flex flex-1 items-center justify-center text-xs text-neutral-600">Coming in P4</div>
          </div>
        </Panel>
        <Separator className="w-px bg-neutral-800 hover:bg-blue-600" />
        <Panel defaultSize={42} minSize={25}>
          <div className="flex h-full flex-col">
            <div className="flex border-b border-neutral-800">
              <button
                onClick={() => setActiveTab('chat')}
                className={`px-4 py-2 text-xs ${activeTab === 'chat' ? 'border-b-2 border-blue-500 text-white' : 'text-neutral-600 hover:text-neutral-400'}`}
              >
                Chat
              </button>
              <button
                onClick={() => setActiveTab('code')}
                className={`px-4 py-2 text-xs ${activeTab === 'code' ? 'border-b-2 border-blue-500 text-white' : 'text-neutral-600 hover:text-neutral-400'}`}
              >
                Code
              </button>
            </div>
            {activeTab === 'chat' ? (
              <ChatPanel
                projectId={project.id}
                currentFiles={files}
                onFilesChanged={setFiles}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center text-xs text-neutral-600">
                Coming in P4
              </div>
            )}
          </div>
        </Panel>
        <Separator className="w-px bg-neutral-800 hover:bg-blue-600" />
        <Panel defaultSize={43} minSize={20}>
          <PreviewPanel />
        </Panel>
      </Group>

      <div className="flex h-6 items-center gap-4 border-t border-neutral-800 px-4 text-[10px] text-neutral-600">
        <SandboxStatusIndicator />
        <span>{Object.keys(files).length} files</span>
      </div>
    </div>
  )
}

function SandboxStatusIndicator() {
  const status = useSandboxStore((s) => s.status)
  const labels: Record<typeof status, string> = { idle: 'Idle', booting: 'Starting...', installing: 'Installing...', running: 'Running', error: 'Error' }
  const colors: Record<typeof status, string> = { idle: 'text-neutral-600', booting: 'text-yellow-500', installing: 'text-yellow-500', running: 'text-green-500', error: 'text-red-500' }
  return <span className={colors[status]}>{labels[status]}</span>
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/dashboard/workspace-shell.tsx
git commit -m "feat(web): wire chat panel into workspace with tab switching"
```

---

## Task 6: Build Verification & Push

- [ ] **Step 1: Full typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 2: Build**

```bash
pnpm build
```

- [ ] **Step 3: Commit and push**

```bash
git add -A && git diff --cached --quiet || git commit -m "chore: P3 final verification"
git push origin main
```
