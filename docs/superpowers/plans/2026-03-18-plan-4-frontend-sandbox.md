# Plan 4: Frontend + WebContainer Sandbox

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the three-column UI (file tree, chat/code, preview) with WebContainer sandbox integration, Zustand state management, and real-time preview.

**Architecture:** React SPA with Zustand store as single source of truth. Chat panel sends messages via SSE to the backend, receives file operations, and syncs them to the WebContainer sandbox. The sandbox runs a Vite dev server for live preview in an iframe.

**Tech Stack:** React 19, Zustand, Monaco Editor, WebContainer API, react-markdown, shiki, shadcn/ui, react-resizable-panels

---

## File Structure

```
packages/web/src/
├── App.tsx                          # (modify: add routing)
├── main.tsx                         # (existing)
├── stores/
│   └── app-store.ts                 # Zustand global store
├── lib/
│   ├── api.ts                       # HTTP/SSE client for backend
│   └── sandbox.ts                   # WebContainer wrapper (Sandbox interface)
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx             # Three-column layout with resizable panels
│   │   ├── Header.tsx               # Top nav bar
│   │   └── StatusBar.tsx            # Bottom status bar
│   ├── chat/
│   │   ├── ChatPanel.tsx            # Chat container
│   │   ├── MessageList.tsx          # Scrollable message list
│   │   ├── MessageBubble.tsx        # Single message (markdown + code)
│   │   └── ChatInput.tsx            # Input with submit
│   ├── editor/
│   │   ├── CodeEditor.tsx           # Monaco editor wrapper
│   │   ├── FileTree.tsx             # File tree navigation
│   │   └── FileTabs.tsx             # Open file tabs
│   └── preview/
│       ├── PreviewPanel.tsx         # iframe preview
│       ├── DeviceFrame.tsx          # Device size frame
│       └── ErrorOverlay.tsx         # Error display
├── pages/
│   ├── ProjectList.tsx              # / route
│   ├── Workspace.tsx                # /project/:id route
│   └── Login.tsx                    # /login route
└── styles/
    └── globals.css                  # (existing)
```

---

## Task 1: Dependencies & shadcn/ui Setup

**Files:**

- Modify: `packages/web/package.json`

- [ ] **Step 1: Add all dependencies**

```bash
cd packages/web

# Core UI
pnpm add zustand react-router-dom react-resizable-panels

# Code editor & highlighting
pnpm add @monaco-editor/react shiki

# Markdown
pnpm add react-markdown remark-gfm rehype-sanitize

# WebContainer
pnpm add @webcontainer/api

# shadcn/ui prerequisites
pnpm add class-variance-authority clsx tailwind-merge lucide-react

# Dev
pnpm add -D @types/react-router-dom
```

- [ ] **Step 2: Create lib/utils.ts for shadcn**

```typescript
// packages/web/src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 3: Typecheck and commit**

Run: `pnpm install && cd packages/web && pnpm typecheck`

```bash
git add packages/web/
git commit -m "feat(web): add UI dependencies (zustand, monaco, webcontainer, shadcn)"
```

---

## Task 2: Zustand Store

**Files:**

- Create: `packages/web/src/stores/app-store.ts`

- [ ] **Step 1: Create app-store.ts**

```typescript
import { create } from 'zustand'
import type { ChatMessage, FileMap, FileTreeNode, FileOperation } from '@buildn/shared'
import type { SandboxStatus } from '@buildn/shared'

interface AppStore {
  // Project
  projectId: string | null
  projectName: string
  files: FileMap
  fileTree: FileTreeNode[]
  setProject: (id: string, name: string, files: FileMap) => void

  // Chat
  messages: ChatMessage[]
  isGenerating: boolean
  addMessage: (message: ChatMessage) => void
  updateLastAssistant: (update: Partial<ChatMessage>) => void
  setIsGenerating: (v: boolean) => void

  // Editor
  openFiles: string[]
  activeFilePath: string | null
  openFile: (path: string) => void
  closeFile: (path: string) => void
  setActiveFile: (path: string | null) => void

  // Sandbox
  sandboxStatus: SandboxStatus
  previewUrl: string | null
  setSandboxStatus: (status: SandboxStatus) => void
  setPreviewUrl: (url: string | null) => void

  // File operations
  applyFileOperations: (ops: FileOperation[]) => void

  // Deploy
  isDeploying: boolean
  deployUrl: string | null
  setDeploying: (v: boolean) => void
  setDeployUrl: (url: string | null) => void
}

function buildTreeFromPaths(paths: string[]): FileTreeNode[] {
  const root: FileTreeNode[] = []
  for (const filePath of paths.sort()) {
    const parts = filePath.split('/')
    let current = root
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]
      const isFile = i === parts.length - 1
      const currentPath = parts.slice(0, i + 1).join('/')
      let node = current.find((n) => n.name === name)
      if (!node) {
        node = {
          name,
          path: currentPath,
          type: isFile ? 'file' : 'directory',
          ...(isFile ? {} : { children: [] }),
        }
        current.push(node)
      }
      if (!isFile) current = node.children!
    }
  }
  return root
}

export const useAppStore = create<AppStore>((set, get) => ({
  // Project
  projectId: null,
  projectName: '',
  files: {},
  fileTree: [],
  setProject: (id, name, files) =>
    set({
      projectId: id,
      projectName: name,
      files,
      fileTree: buildTreeFromPaths(Object.keys(files)),
    }),

  // Chat
  messages: [],
  isGenerating: false,
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  updateLastAssistant: (update) =>
    set((s) => {
      const msgs = [...s.messages]
      const last = msgs.findLast((m) => m.role === 'assistant')
      if (last) Object.assign(last, update)
      return { messages: msgs }
    }),
  setIsGenerating: (v) => set({ isGenerating: v }),

  // Editor
  openFiles: [],
  activeFilePath: null,
  openFile: (path) =>
    set((s) => ({
      openFiles: s.openFiles.includes(path) ? s.openFiles : [...s.openFiles, path],
      activeFilePath: path,
    })),
  closeFile: (path) =>
    set((s) => {
      const openFiles = s.openFiles.filter((p) => p !== path)
      return {
        openFiles,
        activeFilePath:
          s.activeFilePath === path ? (openFiles[openFiles.length - 1] ?? null) : s.activeFilePath,
      }
    }),
  setActiveFile: (path) => set({ activeFilePath: path }),

  // Sandbox
  sandboxStatus: 'idle',
  previewUrl: null,
  setSandboxStatus: (status) => set({ sandboxStatus: status }),
  setPreviewUrl: (url) => set({ previewUrl: url }),

  // File operations
  applyFileOperations: (ops) =>
    set((s) => {
      const files = { ...s.files }
      for (const op of ops) {
        if (op.type === 'delete') delete files[op.path]
        else if (op.content) files[op.path] = op.content
      }
      return { files, fileTree: buildTreeFromPaths(Object.keys(files)) }
    }),

  // Deploy
  isDeploying: false,
  deployUrl: null,
  setDeploying: (v) => set({ isDeploying: v }),
  setDeployUrl: (url) => set({ deployUrl: url }),
}))
```

- [ ] **Step 2: Typecheck and commit**

Run: `cd packages/web && pnpm typecheck`

```bash
git add packages/web/src/stores/
git commit -m "feat(web): add Zustand global store with chat, editor, sandbox state"
```

---

## Task 3: API Client & Sandbox Wrapper

**Files:**

- Create: `packages/web/src/lib/api.ts`
- Create: `packages/web/src/lib/sandbox.ts`

- [ ] **Step 1: Create api.ts**

```typescript
const API_BASE = '/api'

async function fetchJSON<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token')
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

// Auth
export const api = {
  register: (data: { email: string; password: string; name: string }) =>
    fetchJSON<{ user: any; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    fetchJSON<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  me: () => fetchJSON<{ user: any }>('/auth/me'),

  // Projects
  listProjects: () => fetchJSON<{ projects: any[] }>('/projects'),
  createProject: (data: { name: string; template?: string }) =>
    fetchJSON<{ project: any }>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  getProject: (id: string) =>
    fetchJSON<{ project: any; files: Record<string, string> }>(`/projects/${id}`),
  deleteProject: (id: string) =>
    fetch(`${API_BASE}/projects/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    }),

  // Chat (SSE)
  streamChat: (projectId: string, prompt: string) => {
    const token = localStorage.getItem('token')
    return fetch(`${API_BASE}/projects/${projectId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ prompt }),
    })
  },

  // Messages
  getMessages: (projectId: string) =>
    fetchJSON<{ messages: any[] }>(`/projects/${projectId}/messages`),
}
```

- [ ] **Step 2: Create sandbox.ts**

```typescript
import { WebContainer } from '@webcontainer/api'
import type { FileMap } from '@buildn/shared'

let instance: WebContainer | null = null

export async function bootSandbox(files: FileMap): Promise<WebContainer> {
  if (instance) await instance.teardown()

  instance = await WebContainer.boot()

  // Convert FileMap to WebContainer FileSystemTree
  const tree = fileMapToTree(files)
  await instance.mount(tree)

  return instance
}

export function getSandbox(): WebContainer | null {
  return instance
}

export async function writeFilesToSandbox(wc: WebContainer, files: FileMap) {
  for (const [path, content] of Object.entries(files)) {
    // Ensure parent directories exist
    const dir = path.split('/').slice(0, -1).join('/')
    if (dir) await wc.fs.mkdir(dir, { recursive: true })
    await wc.fs.writeFile(path, content)
  }
}

export async function installDeps(wc: WebContainer): Promise<number> {
  const process = await wc.spawn('npm', ['install'])
  return process.exit
}

export async function startDevServer(wc: WebContainer, onReady: (url: string) => void) {
  const process = await wc.spawn('npm', ['run', 'dev'])

  wc.on('server-ready', (_port, url) => {
    onReady(url)
  })

  return process
}

function fileMapToTree(files: FileMap) {
  const tree: Record<string, any> = {}

  for (const [path, content] of Object.entries(files)) {
    const parts = path.split('/')
    let current = tree

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (i === parts.length - 1) {
        current[part] = { file: { contents: content } }
      } else {
        if (!current[part]) current[part] = { directory: {} }
        current = current[part].directory
      }
    }
  }

  return tree
}
```

- [ ] **Step 3: Typecheck and commit**

Run: `cd packages/web && pnpm typecheck`

```bash
git add packages/web/src/lib/
git commit -m "feat(web): add API client and WebContainer sandbox wrapper"
```

---

## Task 4: Layout Components

**Files:**

- Create: `packages/web/src/components/layout/AppShell.tsx`
- Create: `packages/web/src/components/layout/Header.tsx`
- Create: `packages/web/src/components/layout/StatusBar.tsx`

- [ ] **Step 1: Create Header.tsx**

```tsx
interface HeaderProps {
  projectName: string
  onPublish: () => void
}

export function Header({ projectName, onPublish }: HeaderProps) {
  return (
    <header className="flex h-12 items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4">
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold text-white">造</span>
        <span className="text-sm text-neutral-400">{projectName}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onPublish}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
        >
          Publish
        </button>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Create StatusBar.tsx**

```tsx
import type { SandboxStatus } from '@buildn/shared'

interface StatusBarProps {
  sandboxStatus: SandboxStatus
  fileCount: number
}

const STATUS_LABELS: Record<SandboxStatus, string> = {
  idle: 'Idle',
  booting: 'Starting...',
  installing: 'Installing...',
  running: 'Running',
  building: 'Building...',
  error: 'Error',
}

export function StatusBar({ sandboxStatus, fileCount }: StatusBarProps) {
  return (
    <footer className="flex h-6 items-center gap-4 border-t border-neutral-800 bg-neutral-950 px-4 text-xs text-neutral-500">
      <span>{STATUS_LABELS[sandboxStatus]}</span>
      <span>{fileCount} files</span>
    </footer>
  )
}
```

- [ ] **Step 3: Create AppShell.tsx**

```tsx
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import type { ReactNode } from 'react'

interface AppShellProps {
  sidebar: ReactNode
  main: ReactNode
  preview: ReactNode
}

export function AppShell({ sidebar, main, preview }: AppShellProps) {
  return (
    <PanelGroup direction="horizontal" className="flex-1">
      <Panel defaultSize={15} minSize={10} maxSize={25}>
        <div className="h-full overflow-auto border-r border-neutral-800 bg-neutral-950">
          {sidebar}
        </div>
      </Panel>
      <PanelResizeHandle className="w-1 bg-neutral-800 hover:bg-blue-600 transition-colors" />
      <Panel defaultSize={42} minSize={25}>
        <div className="h-full overflow-hidden bg-neutral-950">{main}</div>
      </Panel>
      <PanelResizeHandle className="w-1 bg-neutral-800 hover:bg-blue-600 transition-colors" />
      <Panel defaultSize={43} minSize={20}>
        <div className="h-full overflow-hidden bg-neutral-900">{preview}</div>
      </Panel>
    </PanelGroup>
  )
}
```

- [ ] **Step 4: Typecheck and commit**

```bash
git add packages/web/src/components/layout/
git commit -m "feat(web): add three-column layout with resizable panels"
```

---

## Task 5: Chat Components

**Files:**

- Create: `packages/web/src/components/chat/ChatPanel.tsx`
- Create: `packages/web/src/components/chat/MessageList.tsx`
- Create: `packages/web/src/components/chat/MessageBubble.tsx`
- Create: `packages/web/src/components/chat/ChatInput.tsx`

- [ ] **Step 1: Create ChatInput.tsx**

```tsx
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

- [ ] **Step 2: Create MessageBubble.tsx**

```tsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from '@buildn/shared'

interface MessageBubbleProps {
  message: ChatMessage
  onFileClick?: (path: string) => void
}

export function MessageBubble({ message, onFileClick }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
          isUser ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-100'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        )}
        {message.fileOperations && message.fileOperations.length > 0 && (
          <div className="mt-2 border-t border-neutral-700 pt-2">
            <p className="text-xs text-neutral-400">Files changed:</p>
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
        {message.status === 'streaming' && (
          <span className="inline-block h-3 w-1 animate-pulse bg-blue-400 ml-1" />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create MessageList.tsx**

```tsx
import { useEffect, useRef } from 'react'
import type { ChatMessage } from '@buildn/shared'
import { MessageBubble } from './MessageBubble'

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
      <div className="flex flex-1 items-center justify-center text-neutral-500">
        <p>Describe what you want to build</p>
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

- [ ] **Step 4: Create ChatPanel.tsx**

```tsx
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import type { ChatMessage } from '@buildn/shared'

interface ChatPanelProps {
  messages: ChatMessage[]
  onSendMessage: (prompt: string) => void
  isGenerating: boolean
  onFileClick?: (path: string) => void
}

export function ChatPanel({ messages, onSendMessage, isGenerating, onFileClick }: ChatPanelProps) {
  return (
    <div className="flex h-full flex-col">
      <MessageList messages={messages} onFileClick={onFileClick} />
      <ChatInput onSubmit={onSendMessage} disabled={isGenerating} />
    </div>
  )
}
```

- [ ] **Step 5: Typecheck and commit**

```bash
git add packages/web/src/components/chat/
git commit -m "feat(web): add chat components with streaming and markdown support"
```

---

## Task 6: Editor & File Tree Components

**Files:**

- Create: `packages/web/src/components/editor/FileTree.tsx`
- Create: `packages/web/src/components/editor/FileTabs.tsx`
- Create: `packages/web/src/components/editor/CodeEditor.tsx`

- [ ] **Step 1: Create FileTree.tsx**

```tsx
import type { FileTreeNode } from '@buildn/shared'
import { useState } from 'react'

interface FileTreeProps {
  tree: FileTreeNode[]
  selectedPath: string | null
  onSelect: (path: string) => void
  changedPaths?: string[]
}

function TreeNode({
  node,
  depth,
  selectedPath,
  onSelect,
  changedPaths,
}: {
  node: FileTreeNode
  depth: number
  selectedPath: string | null
  onSelect: (p: string) => void
  changedPaths?: string[]
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const isChanged = changedPaths?.includes(node.path)
  const isSelected = selectedPath === node.path

  if (node.type === 'directory') {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-1 px-2 py-0.5 text-xs text-neutral-400 hover:bg-neutral-800"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <span>{expanded ? '▼' : '▶'}</span>
          <span>{node.name}</span>
        </button>
        {expanded &&
          node.children?.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              changedPaths={changedPaths}
            />
          ))}
      </div>
    )
  }

  return (
    <button
      onClick={() => onSelect(node.path)}
      className={`flex w-full items-center gap-1 px-2 py-0.5 text-xs ${isSelected ? 'bg-blue-600/20 text-blue-400' : 'text-neutral-300 hover:bg-neutral-800'}`}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <span>{node.name}</span>
      {isChanged && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-yellow-500" />}
    </button>
  )
}

export function FileTree({ tree, selectedPath, onSelect, changedPaths }: FileTreeProps) {
  return (
    <div className="py-2">
      <p className="px-3 pb-2 text-xs font-semibold uppercase text-neutral-500">Files</p>
      {tree.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
          changedPaths={changedPaths}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create FileTabs.tsx**

```tsx
interface FileTabsProps {
  openFiles: string[]
  activePath: string | null
  onSelect: (path: string) => void
  onClose: (path: string) => void
}

export function FileTabs({ openFiles, activePath, onSelect, onClose }: FileTabsProps) {
  if (openFiles.length === 0) return null

  return (
    <div className="flex border-b border-neutral-800 bg-neutral-950 overflow-x-auto">
      {openFiles.map((path) => {
        const name = path.split('/').pop() ?? path
        const isActive = path === activePath
        return (
          <div
            key={path}
            className={`flex items-center gap-1 border-r border-neutral-800 px-3 py-1.5 text-xs cursor-pointer ${isActive ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
            onClick={() => onSelect(path)}
          >
            <span>{name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onClose(path)
              }}
              className="ml-1 text-neutral-600 hover:text-white"
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Create CodeEditor.tsx**

```tsx
import Editor from '@monaco-editor/react'

interface CodeEditorProps {
  file: { path: string; content: string } | null
  onChange?: (path: string, content: string) => void
  readOnly?: boolean
}

function getLanguage(path: string): string {
  if (path.endsWith('.tsx') || path.endsWith('.ts')) return 'typescript'
  if (path.endsWith('.jsx') || path.endsWith('.js')) return 'javascript'
  if (path.endsWith('.css')) return 'css'
  if (path.endsWith('.json')) return 'json'
  if (path.endsWith('.html')) return 'html'
  if (path.endsWith('.md')) return 'markdown'
  return 'plaintext'
}

export function CodeEditor({ file, onChange, readOnly }: CodeEditorProps) {
  if (!file) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500 text-sm">
        Select a file to view
      </div>
    )
  }

  return (
    <Editor
      height="100%"
      language={getLanguage(file.path)}
      value={file.content}
      onChange={(value) => onChange?.(file.path, value ?? '')}
      theme="vs-dark"
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        tabSize: 2,
      }}
    />
  )
}
```

- [ ] **Step 4: Typecheck and commit**

```bash
git add packages/web/src/components/editor/
git commit -m "feat(web): add file tree, tabs, and Monaco code editor"
```

---

## Task 7: Preview Components

**Files:**

- Create: `packages/web/src/components/preview/PreviewPanel.tsx`
- Create: `packages/web/src/components/preview/DeviceFrame.tsx`
- Create: `packages/web/src/components/preview/ErrorOverlay.tsx`

- [ ] **Step 1: Create DeviceFrame.tsx**

```tsx
type DeviceType = 'desktop' | 'tablet' | 'phone'

const SIZES: Record<DeviceType, { width: string; label: string }> = {
  desktop: { width: '100%', label: 'Desktop' },
  tablet: { width: '768px', label: 'Tablet' },
  phone: { width: '375px', label: 'Phone' },
}

interface DeviceFrameProps {
  device: DeviceType
  onDeviceChange: (d: DeviceType) => void
}

export function DeviceFrame({ device, onDeviceChange }: DeviceFrameProps) {
  return (
    <div className="flex gap-1 px-3 py-1.5 border-b border-neutral-800">
      {(Object.keys(SIZES) as DeviceType[]).map((d) => (
        <button
          key={d}
          onClick={() => onDeviceChange(d)}
          className={`rounded px-2 py-0.5 text-xs ${d === device ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
        >
          {SIZES[d].label}
        </button>
      ))}
    </div>
  )
}

export { SIZES, type DeviceType }
```

- [ ] **Step 2: Create ErrorOverlay.tsx**

```tsx
interface ErrorOverlayProps {
  error: string | null
  onDismiss: () => void
}

export function ErrorOverlay({ error, onDismiss }: ErrorOverlayProps) {
  if (!error) return null

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 p-4">
      <div className="max-w-md rounded-lg bg-red-950 border border-red-800 p-4">
        <p className="text-sm font-medium text-red-300">Preview Error</p>
        <pre className="mt-2 text-xs text-red-400 whitespace-pre-wrap">{error}</pre>
        <button
          onClick={onDismiss}
          className="mt-3 rounded bg-red-800 px-3 py-1 text-xs text-white hover:bg-red-700"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create PreviewPanel.tsx**

```tsx
import { useState } from 'react'
import { DeviceFrame, SIZES, type DeviceType } from './DeviceFrame'
import { ErrorOverlay } from './ErrorOverlay'

interface PreviewPanelProps {
  url: string | null
  isLoading: boolean
  error?: string | null
}

export function PreviewPanel({ url, isLoading, error }: PreviewPanelProps) {
  const [device, setDevice] = useState<DeviceType>('desktop')
  const [previewError, setPreviewError] = useState<string | null>(null)

  const displayError = error ?? previewError

  return (
    <div className="relative flex h-full flex-col">
      <DeviceFrame device={device} onDeviceChange={setDevice} />
      <div className="flex flex-1 items-center justify-center overflow-hidden p-2">
        {isLoading && <p className="text-sm text-neutral-500">Loading preview...</p>}
        {!isLoading && !url && (
          <p className="text-sm text-neutral-500">Send a message to see the preview</p>
        )}
        {url && (
          <iframe
            src={url}
            title="Preview"
            className="rounded border border-neutral-700 bg-white"
            style={{ width: SIZES[device].width, height: '100%', maxWidth: '100%' }}
            sandbox="allow-scripts allow-same-origin"
            onError={() => setPreviewError('Failed to load preview')}
          />
        )}
      </div>
      <ErrorOverlay error={displayError} onDismiss={() => setPreviewError(null)} />
    </div>
  )
}
```

- [ ] **Step 4: Typecheck and commit**

```bash
git add packages/web/src/components/preview/
git commit -m "feat(web): add preview panel with device frame toggle"
```

---

## Task 8: Pages & Routing

**Files:**

- Create: `packages/web/src/pages/Login.tsx`
- Create: `packages/web/src/pages/ProjectList.tsx`
- Create: `packages/web/src/pages/Workspace.tsx`
- Modify: `packages/web/src/App.tsx`

- [ ] **Step 1: Create Login.tsx** — simple login form
- [ ] **Step 2: Create ProjectList.tsx** — card grid of user projects
- [ ] **Step 3: Create Workspace.tsx** — connects store to AppShell + Chat + Editor + Preview
- [ ] **Step 4: Update App.tsx** — add react-router with 3 routes (`/`, `/project/:id`, `/login`)

- [ ] **Step 5: Typecheck and commit**

```bash
git add packages/web/src/
git commit -m "feat(web): add pages with routing (login, project list, workspace)"
```

---

## Task 9: Full Frontend Build Verification

- [ ] **Step 1: Typecheck**

Run: `cd packages/web && pnpm typecheck`

- [ ] **Step 2: Build**

Run: `cd packages/web && pnpm build`

- [ ] **Step 3: Monorepo build**

Run: `pnpm build`

- [ ] **Step 4: Final commit if needed**
