# Buildn V2 P4: Code Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add file tree navigation, tab-based file switching, and Monaco Editor to the Workspace — users can browse and manually edit generated code, with changes synced to the WebContainer.

**Architecture:** An editor Zustand store tracks open files and the active file path. A FileTree component renders the left panel from the `files` FileMap. FileTabs shows open files above the Monaco editor. Manual edits update the local `files` state and sync to WebContainer via `writeFilesToContainer`. Clicking a file in a chat message's "Files changed" list opens it in the editor.

**Tech Stack:** @monaco-editor/react, Zustand, @buildn/sandbox (writeFilesToContainer)

---

## File Structure

```
apps/web/
├── lib/
│   └── stores/
│       └── editor-store.ts            # Editor state (open files, active file)
├── components/
│   └── editor/
│       ├── file-tree.tsx              # Recursive tree with expand/collapse
│       ├── file-tabs.tsx              # Open file tabs with close button
│       └── code-editor.tsx            # Monaco Editor wrapper
├── components/dashboard/
│   └── workspace-shell.tsx            # Modify: wire file tree + editor into panels
└── package.json                       # Modify: add @monaco-editor/react
```

---

## Task 1: Dependencies

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install Monaco Editor**

```bash
cd apps/web && pnpm add @monaco-editor/react
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add @monaco-editor/react"
```

---

## Task 2: Editor Store

**Files:**
- Create: `apps/web/lib/stores/editor-store.ts`

- [ ] **Step 1: Create editor-store.ts**

```typescript
'use client'

import { create } from 'zustand'

interface EditorStore {
  openFiles: string[]
  activeFilePath: string | null

  openFile: (path: string) => void
  closeFile: (path: string) => void
  setActiveFile: (path: string | null) => void
  reset: () => void
}

export const useEditorStore = create<EditorStore>((set) => ({
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
          s.activeFilePath === path
            ? openFiles[openFiles.length - 1] ?? null
            : s.activeFilePath,
      }
    }),

  setActiveFile: (path) => set({ activeFilePath: path }),
  reset: () => set({ openFiles: [], activeFilePath: null }),
}))
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/stores/editor-store.ts
git commit -m "feat(web): add editor Zustand store"
```

---

## Task 3: File Tree Component

**Files:**
- Create: `apps/web/components/editor/file-tree.tsx`

- [ ] **Step 1: Create file-tree.tsx**

```tsx
'use client'

import { useState } from 'react'
import type { FileMap } from '@buildn/shared'

interface FileTreeProps {
  files: FileMap
  activeFilePath: string | null
  onSelectFile: (path: string) => void
}

interface TreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: TreeNode[]
}

function buildTree(files: FileMap): TreeNode[] {
  const root: TreeNode[] = []
  for (const filePath of Object.keys(files).sort()) {
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

function TreeNodeItem({
  node,
  depth,
  activeFilePath,
  onSelectFile,
}: {
  node: TreeNode
  depth: number
  activeFilePath: string | null
  onSelectFile: (path: string) => void
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const isActive = activeFilePath === node.path

  if (node.type === 'directory') {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-1 py-0.5 text-xs text-neutral-400 hover:bg-neutral-800"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <span className="text-[10px]">{expanded ? '\u25BC' : '\u25B6'}</span>
          <span>{node.name}</span>
        </button>
        {expanded &&
          node.children?.map((child) => (
            <TreeNodeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              activeFilePath={activeFilePath}
              onSelectFile={onSelectFile}
            />
          ))}
      </div>
    )
  }

  return (
    <button
      onClick={() => onSelectFile(node.path)}
      className={`flex w-full items-center py-0.5 text-xs ${
        isActive
          ? 'bg-blue-600/20 text-blue-400'
          : 'text-neutral-300 hover:bg-neutral-800'
      }`}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
    >
      <span>{node.name}</span>
    </button>
  )
}

export function FileTree({ files, activeFilePath, onSelectFile }: FileTreeProps) {
  const tree = buildTree(files)

  if (Object.keys(files).length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-xs text-neutral-600">
        No files yet
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto py-1">
      {tree.map((node) => (
        <TreeNodeItem
          key={node.path}
          node={node}
          depth={0}
          activeFilePath={activeFilePath}
          onSelectFile={onSelectFile}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/editor/file-tree.tsx
git commit -m "feat(web): add file tree component with expand/collapse"
```

---

## Task 4: File Tabs Component

**Files:**
- Create: `apps/web/components/editor/file-tabs.tsx`

- [ ] **Step 1: Create file-tabs.tsx**

```tsx
'use client'

interface FileTabsProps {
  openFiles: string[]
  activePath: string | null
  onSelect: (path: string) => void
  onClose: (path: string) => void
}

export function FileTabs({ openFiles, activePath, onSelect, onClose }: FileTabsProps) {
  if (openFiles.length === 0) return null

  return (
    <div className="flex overflow-x-auto border-b border-neutral-800 bg-neutral-950">
      {openFiles.map((path) => {
        const name = path.split('/').pop() ?? path
        const isActive = path === activePath
        return (
          <div
            key={path}
            onClick={() => onSelect(path)}
            className={`flex cursor-pointer items-center gap-1 border-r border-neutral-800 px-3 py-1.5 text-xs ${
              isActive
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <span>{name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onClose(path)
              }}
              className="ml-1 text-neutral-600 hover:text-white"
            >
              &times;
            </button>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/editor/file-tabs.tsx
git commit -m "feat(web): add file tabs component"
```

---

## Task 5: Monaco Code Editor

**Files:**
- Create: `apps/web/components/editor/code-editor.tsx`

- [ ] **Step 1: Create code-editor.tsx**

```tsx
'use client'

import Editor from '@monaco-editor/react'

interface CodeEditorProps {
  path: string
  content: string
  onChange: (content: string) => void
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

export function CodeEditor({ path, content, onChange }: CodeEditorProps) {
  return (
    <Editor
      key={path}
      height="100%"
      language={getLanguage(path)}
      value={content}
      onChange={(value) => onChange(value ?? '')}
      theme="vs-dark"
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        tabSize: 2,
        automaticLayout: true,
      }}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/editor/code-editor.tsx
git commit -m "feat(web): add Monaco code editor wrapper"
```

---

## Task 6: Wire Editor into Workspace

**Files:**
- Modify: `apps/web/components/dashboard/workspace-shell.tsx`

Replace the entire file. Key changes from P3 version:
1. Import `useEditorStore`, `FileTree`, `FileTabs`, `CodeEditor`
2. Left panel: replace "Coming in P4" with `<FileTree>`
3. Code tab: replace placeholder with `<FileTabs>` + `<CodeEditor>`
4. `onFileClick` from ChatPanel opens file in editor and switches to code tab
5. Manual edits in Monaco update `files` state and sync to WebContainer

- [ ] **Step 1: Replace workspace-shell.tsx**

```tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Group, Panel, Separator } from 'react-resizable-panels'
import type { Project, FileMap } from '@buildn/shared'
import { bootSandbox, installDeps, startDevServer, teardownSandbox, writeFilesToContainer, getSandbox } from '@buildn/sandbox'
import { useSandboxStore } from '@/lib/stores/sandbox-store'
import { useEditorStore } from '@/lib/stores/editor-store'
import { PreviewPanel } from '@/components/preview/preview-panel'
import { ChatPanel } from '@/components/chat/chat-panel'
import { FileTree } from '@/components/editor/file-tree'
import { FileTabs } from '@/components/editor/file-tabs'
import { CodeEditor } from '@/components/editor/code-editor'

interface WorkspaceShellProps {
  project: Project
  initialFiles: FileMap
}

export function WorkspaceShell({ project, initialFiles }: WorkspaceShellProps) {
  const { setStatus, setPreviewUrl, setError, reset: resetSandbox } = useSandboxStore()
  const { openFiles, activeFilePath, openFile, closeFile, setActiveFile, reset: resetEditor } = useEditorStore()
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
    return () => {
      cancelled = true
      resetSandbox()
      resetEditor()
      teardownSandbox().catch(() => {})
    }
  }, [initialFiles, setStatus, setPreviewUrl, setError, resetSandbox, resetEditor])

  const handleFileSelect = useCallback((path: string) => {
    openFile(path)
    setActiveTab('code')
  }, [openFile])

  const handleEditorChange = useCallback((content: string) => {
    if (!activeFilePath) return
    setFiles((prev) => ({ ...prev, [activeFilePath]: content }))

    // Sync to WebContainer
    const wc = getSandbox()
    if (wc) {
      writeFilesToContainer(wc, { [activeFilePath]: content }).catch(console.error)
    }
  }, [activeFilePath])

  const activeFileContent = activeFilePath ? files[activeFilePath] ?? '' : ''

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
        {/* Left: File Tree */}
        <Panel defaultSize={15} minSize={10} maxSize={25}>
          <div className="flex h-full flex-col border-r border-neutral-800">
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
              Files
            </div>
            <FileTree
              files={files}
              activeFilePath={activeFilePath}
              onSelectFile={handleFileSelect}
            />
          </div>
        </Panel>
        <Separator className="w-px bg-neutral-800 hover:bg-blue-600" />

        {/* Center: Chat / Code */}
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
                onFileClick={handleFileSelect}
              />
            ) : (
              <div className="flex flex-1 flex-col">
                <FileTabs
                  openFiles={openFiles}
                  activePath={activeFilePath}
                  onSelect={setActiveFile}
                  onClose={closeFile}
                />
                {activeFilePath ? (
                  <CodeEditor
                    path={activeFilePath}
                    content={activeFileContent}
                    onChange={handleEditorChange}
                  />
                ) : (
                  <div className="flex flex-1 items-center justify-center text-xs text-neutral-600">
                    Select a file from the tree to edit
                  </div>
                )}
              </div>
            )}
          </div>
        </Panel>
        <Separator className="w-px bg-neutral-800 hover:bg-blue-600" />

        {/* Right: Preview */}
        <Panel defaultSize={43} minSize={20}>
          <PreviewPanel />
        </Panel>
      </Group>

      <div className="flex h-6 items-center gap-4 border-t border-neutral-800 px-4 text-[10px] text-neutral-600">
        <SandboxStatusIndicator />
        <span>{Object.keys(files).length} files</span>
        {activeFilePath && <span className="text-neutral-500">{activeFilePath}</span>}
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

**Note:** ChatPanel needs a new `onFileClick` prop. Update `apps/web/components/chat/chat-panel.tsx` to accept and forward it:

Add `onFileClick?: (path: string) => void` to `ChatPanelProps` and pass it to `<MessageList onFileClick={onFileClick} />`.

- [ ] **Step 2: Update chat-panel.tsx to accept onFileClick**

In `apps/web/components/chat/chat-panel.tsx`, add `onFileClick` to the interface and pass through:

```tsx
interface ChatPanelProps {
  projectId: string
  currentFiles: FileMap
  onFilesChanged?: (files: FileMap) => void
  onFileClick?: (path: string) => void  // ADD THIS
}

export function ChatPanel({ projectId, currentFiles, onFilesChanged, onFileClick }: ChatPanelProps) {
  // ... existing code ...
  return (
    <div className="flex h-full flex-col">
      <MessageList messages={messages} onFileClick={onFileClick} />  {/* PASS onFileClick */}
      <ChatInput onSubmit={handleSend} disabled={isGenerating} />
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/
git commit -m "feat(web): wire file tree, tabs, and Monaco editor into workspace"
```

---

## Task 7: Build Verification & Push

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
git add -A && git diff --cached --quiet || git commit -m "chore: P4 final verification"
git push origin main
```
