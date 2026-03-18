# Buildn V2 P2: Sandbox & Live Preview — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add WebContainer-based sandbox and live preview to the Workspace, so generated code runs in-browser with Vite HMR and renders in an iframe.

**Architecture:** A `packages/sandbox` package wraps the WebContainer API (boot, mount files, install deps, start Vite dev server). Preview components (iframe + device frame) replace the "Coming in P2" placeholder in the Workspace right panel. A Zustand store manages sandbox state. COOP/COEP headers are set in Next.js config (required for SharedArrayBuffer).

**Tech Stack:** @webcontainer/api, Zustand, react-resizable-panels (existing), Next.js 15

---

## File Structure

```
packages/
└── sandbox/
    ├── src/
    │   ├── index.ts                   # Export all public API
    │   ├── manager.ts                 # WebContainer lifecycle (boot, teardown)
    │   ├── files.ts                   # FileMap ↔ WebContainer FileSystemTree conversion + write
    │   └── dev-server.ts              # Install deps + start Vite + listen for server-ready
    ├── package.json
    └── tsconfig.json
apps/web/
├── lib/
│   └── stores/
│       └── sandbox-store.ts           # Zustand store for sandbox state
├── components/
│   └── preview/
│       ├── preview-panel.tsx          # iframe + loading/error states
│       └── device-frame.tsx           # Desktop/Tablet/Phone size switcher
├── components/dashboard/
│   └── workspace-shell.tsx            # Modify: replace right panel placeholder
├── next.config.ts                     # Modify: add COOP/COEP headers
└── app/(dashboard)/project/[id]/
    └── page.tsx                       # Modify: pass files to workspace
```

---

## Task 1: Sandbox Package

**Files:**
- Create: `packages/sandbox/package.json`
- Create: `packages/sandbox/tsconfig.json`
- Create: `packages/sandbox/src/index.ts`
- Create: `packages/sandbox/src/manager.ts`
- Create: `packages/sandbox/src/files.ts`
- Create: `packages/sandbox/src/dev-server.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@buildn/sandbox",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": { "types": "./src/index.ts", "import": "./src/index.ts", "default": "./src/index.ts" }
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@webcontainer/api": "^1.6"
  },
  "devDependencies": {
    "@buildn/shared": "workspace:*",
    "typescript": "^5.7"
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
    "lib": ["ES2022", "DOM"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create src/files.ts**

```typescript
import type { FileMap } from '@buildn/shared'
import type { WebContainer, FileSystemTree } from '@webcontainer/api'

export function fileMapToTree(files: FileMap): FileSystemTree {
  const tree: FileSystemTree = {}

  for (const [path, content] of Object.entries(files)) {
    const parts = path.split('/')
    let current: any = tree

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

export async function writeFilesToContainer(
  wc: WebContainer,
  files: FileMap,
): Promise<void> {
  for (const [path, content] of Object.entries(files)) {
    const dir = path.split('/').slice(0, -1).join('/')
    if (dir) await wc.fs.mkdir(dir, { recursive: true })
    await wc.fs.writeFile(path, content)
  }
}

export function hasPackageJsonChanged(
  oldFiles: FileMap,
  newFiles: FileMap,
): boolean {
  return oldFiles['package.json'] !== newFiles['package.json']
}
```

- [ ] **Step 4: Create src/manager.ts**

```typescript
import { WebContainer } from '@webcontainer/api'
import type { FileMap } from '@buildn/shared'
import { fileMapToTree } from './files'

let instance: WebContainer | null = null

export async function bootSandbox(files: FileMap): Promise<WebContainer> {
  if (instance) {
    await instance.teardown()
    instance = null
  }

  instance = await WebContainer.boot()
  const tree = fileMapToTree(files)
  await instance.mount(tree)
  return instance
}

export function getSandbox(): WebContainer | null {
  return instance
}

export async function teardownSandbox(): Promise<void> {
  if (instance) {
    await instance.teardown()
    instance = null
  }
}
```

- [ ] **Step 5: Create src/dev-server.ts**

```typescript
import type { WebContainer, WebContainerProcess } from '@webcontainer/api'

export async function installDeps(wc: WebContainer): Promise<number> {
  const process = await wc.spawn('npm', ['install'])

  // Pipe output for debugging
  process.output.pipeTo(
    new WritableStream({
      write(chunk) {
        console.log('[npm]', chunk)
      },
    }),
  ).catch(() => {})

  return process.exit
}

export async function startDevServer(
  wc: WebContainer,
  onReady: (url: string) => void,
  onError?: (error: string) => void,
): Promise<WebContainerProcess> {
  const process = await wc.spawn('npm', ['run', 'dev'])

  process.output.pipeTo(
    new WritableStream({
      write(chunk) {
        console.log('[vite]', chunk)
      },
    }),
  ).catch(() => {})

  wc.on('server-ready', (_port, url) => {
    onReady(url)
  })

  wc.on('error', (err) => {
    onError?.(err.message)
  })

  return process
}
```

- [ ] **Step 6: Create src/index.ts**

```typescript
export { bootSandbox, getSandbox, teardownSandbox } from './manager'
export { writeFilesToContainer, hasPackageJsonChanged } from './files'
export { installDeps, startDevServer } from './dev-server'
```

- [ ] **Step 7: Install and typecheck**

```bash
cd /Users/allen/AllenProject/buildn-app && pnpm install
cd packages/sandbox && pnpm typecheck
```

- [ ] **Step 8: Commit**

```bash
git add packages/sandbox/
git commit -m "feat(sandbox): add WebContainer wrapper package"
```

---

## Task 2: Next.js COOP/COEP Headers

**Files:**
- Modify: `apps/web/next.config.ts`

WebContainer requires `Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Opener-Policy: same-origin` for SharedArrayBuffer.

- [ ] **Step 1: Update next.config.ts**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@buildn/shared', '@buildn/ai-engine', '@buildn/sandbox'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
```

- [ ] **Step 2: Add sandbox dependency to apps/web**

Add to `apps/web/package.json` dependencies:
```json
"@buildn/sandbox": "workspace:*"
```

- [ ] **Step 3: Install and typecheck**

```bash
pnpm install && cd apps/web && pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/
git commit -m "feat(web): add COOP/COEP headers and sandbox dependency"
```

---

## Task 3: Sandbox Zustand Store

**Files:**
- Create: `apps/web/lib/stores/sandbox-store.ts`

- [ ] **Step 1: Add zustand if not already installed**

Check `apps/web/package.json` — Zustand is already in dependencies from P0.

- [ ] **Step 2: Create sandbox-store.ts**

```typescript
'use client'

import { create } from 'zustand'

export type SandboxStatus = 'idle' | 'booting' | 'installing' | 'running' | 'error'

interface SandboxStore {
  status: SandboxStatus
  previewUrl: string | null
  error: string | null

  setStatus: (status: SandboxStatus) => void
  setPreviewUrl: (url: string | null) => void
  setError: (error: string | null) => void
  reset: () => void
}

export const useSandboxStore = create<SandboxStore>((set) => ({
  status: 'idle',
  previewUrl: null,
  error: null,

  setStatus: (status) => set({ status, ...(status !== 'error' ? { error: null } : {}) }),
  setPreviewUrl: (previewUrl) => set({ previewUrl }),
  setError: (error) => set({ error, status: 'error' }),
  reset: () => set({ status: 'idle', previewUrl: null, error: null }),
}))
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/stores/
git commit -m "feat(web): add sandbox Zustand store"
```

---

## Task 4: Preview Components

**Files:**
- Create: `apps/web/components/preview/device-frame.tsx`
- Create: `apps/web/components/preview/preview-panel.tsx`

- [ ] **Step 1: Create device-frame.tsx**

```tsx
'use client'

export type DeviceType = 'desktop' | 'tablet' | 'phone'

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
    <div className="flex gap-1 border-b border-neutral-800 px-3 py-1.5">
      {(Object.keys(SIZES) as DeviceType[]).map((d) => (
        <button
          key={d}
          onClick={() => onDeviceChange(d)}
          className={`rounded px-2 py-0.5 text-xs ${
            d === device
              ? 'bg-neutral-700 text-white'
              : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          {SIZES[d].label}
        </button>
      ))}
    </div>
  )
}

export { SIZES }
```

- [ ] **Step 2: Create preview-panel.tsx**

```tsx
'use client'

import { useState } from 'react'
import { useSandboxStore, type SandboxStatus } from '@/lib/stores/sandbox-store'
import { DeviceFrame, SIZES, type DeviceType } from './device-frame'

const STATUS_MESSAGES: Record<SandboxStatus, string> = {
  idle: 'Waiting...',
  booting: 'Starting sandbox...',
  installing: 'Installing dependencies...',
  running: '',
  error: 'Something went wrong',
}

export function PreviewPanel() {
  const { status, previewUrl, error } = useSandboxStore()
  const [device, setDevice] = useState<DeviceType>('desktop')

  return (
    <div className="relative flex h-full flex-col bg-neutral-900">
      <DeviceFrame device={device} onDeviceChange={setDevice} />

      <div className="flex flex-1 items-center justify-center overflow-hidden p-2">
        {status === 'running' && previewUrl ? (
          <iframe
            src={previewUrl}
            title="Preview"
            className="rounded border border-neutral-700 bg-white"
            style={{
              width: SIZES[device].width,
              height: '100%',
              maxWidth: '100%',
            }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        ) : (
          <div className="text-center">
            {(status === 'booting' || status === 'installing') && (
              <div className="mb-2 h-5 w-5 mx-auto animate-spin rounded-full border-2 border-neutral-600 border-t-blue-500" />
            )}
            <p className="text-sm text-neutral-500">
              {error || STATUS_MESSAGES[status]}
            </p>
            {status === 'idle' && (
              <p className="mt-1 text-xs text-neutral-600">
                Send a message to generate code and see the preview
              </p>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="absolute bottom-0 left-0 right-0 border-t border-red-900 bg-red-950/90 px-4 py-2">
          <p className="text-xs text-red-400">{error}</p>
          <button
            onClick={() => useSandboxStore.getState().setError(null)}
            className="mt-1 text-xs text-red-500 hover:text-red-300"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Typecheck and commit**

```bash
cd apps/web && pnpm typecheck
git add apps/web/components/preview/
git commit -m "feat(web): add preview panel with device frame switcher"
```

---

## Task 5: Wire Preview into Workspace

**Files:**
- Modify: `apps/web/components/dashboard/workspace-shell.tsx`
- Modify: `apps/web/app/(dashboard)/project/[id]/page.tsx`

- [ ] **Step 1: Update workspace-shell.tsx**

Replace the entire right panel placeholder with PreviewPanel. Also add sandbox boot logic on mount.

```tsx
'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Group, Panel, Separator } from 'react-resizable-panels'
import type { Project, FileMap } from '@buildn/shared'
import { bootSandbox, installDeps, startDevServer, teardownSandbox } from '@buildn/sandbox'
import { useSandboxStore } from '@/lib/stores/sandbox-store'
import { PreviewPanel } from '@/components/preview/preview-panel'

interface WorkspaceShellProps {
  project: Project
  initialFiles: FileMap
}

export function WorkspaceShell({ project, initialFiles }: WorkspaceShellProps) {
  const { setStatus, setPreviewUrl, setError, reset } = useSandboxStore()

  useEffect(() => {
    // Only boot if we have files
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
        if (exitCode !== 0) {
          setError('Failed to install dependencies')
          return
        }

        setStatus('running')
        await startDevServer(
          wc,
          (url) => setPreviewUrl(url),
          (err) => setError(err),
        )
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to start sandbox')
        }
      }
    }

    boot()

    return () => {
      cancelled = true
      reset()
      teardownSandbox().catch(() => {})
    }
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
          <button className="rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-400 hover:text-white">
            Share
          </button>
          <button className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-500">
            Publish
          </button>
        </div>
      </div>

      <Group orientation="horizontal" className="flex-1">
        <Panel defaultSize={15} minSize={10} maxSize={25}>
          <div className="flex h-full flex-col border-r border-neutral-800">
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
              Files
            </div>
            <div className="flex flex-1 items-center justify-center text-xs text-neutral-600">
              Coming in P4
            </div>
          </div>
        </Panel>
        <Separator className="w-px bg-neutral-800 hover:bg-blue-600" />
        <Panel defaultSize={42} minSize={25}>
          <div className="flex h-full flex-col">
            <div className="flex border-b border-neutral-800">
              <div className="border-b-2 border-blue-500 px-4 py-2 text-xs text-white">Chat</div>
              <div className="px-4 py-2 text-xs text-neutral-600">Code</div>
            </div>
            <div className="flex flex-1 items-center justify-center text-xs text-neutral-600">
              Coming in P3
            </div>
          </div>
        </Panel>
        <Separator className="w-px bg-neutral-800 hover:bg-blue-600" />
        <Panel defaultSize={43} minSize={20}>
          <PreviewPanel />
        </Panel>
      </Group>

      <div className="flex h-6 items-center gap-4 border-t border-neutral-800 px-4 text-[10px] text-neutral-600">
        <SandboxStatusIndicator />
        <span>{Object.keys(initialFiles).length} files</span>
      </div>
    </div>
  )
}

function SandboxStatusIndicator() {
  const status = useSandboxStore((s) => s.status)
  const labels: Record<typeof status, string> = {
    idle: 'Idle',
    booting: 'Starting...',
    installing: 'Installing...',
    running: 'Running',
    error: 'Error',
  }
  const colors: Record<typeof status, string> = {
    idle: 'text-neutral-600',
    booting: 'text-yellow-500',
    installing: 'text-yellow-500',
    running: 'text-green-500',
    error: 'text-red-500',
  }
  return <span className={colors[status]}>{labels[status]}</span>
}
```

- [ ] **Step 2: Update workspace page to pass files**

Update `apps/web/app/(dashboard)/project/[id]/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WorkspaceShell } from '@/components/dashboard/workspace-shell'
import type { FileMap } from '@buildn/shared'

export default async function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (!project) redirect('/dashboard')

  // Load project files
  const { data: fileRows } = await supabase
    .from('files')
    .select('path, content')
    .eq('project_id', id)

  const initialFiles: FileMap = {}
  for (const row of fileRows ?? []) {
    initialFiles[row.path] = row.content
  }

  return <WorkspaceShell project={project} initialFiles={initialFiles} />
}
```

- [ ] **Step 3: Typecheck and commit**

```bash
cd apps/web && pnpm typecheck
git add apps/web/
git commit -m "feat(web): wire sandbox + preview into workspace"
```

---

## Task 6: Build Verification

- [ ] **Step 1: Full typecheck**

```bash
pnpm typecheck
```
Expected: All packages pass

- [ ] **Step 2: Build**

```bash
pnpm build
```
Expected: Next.js build succeeds

- [ ] **Step 3: Commit and push**

```bash
git add -A && git diff --cached --quiet || git commit -m "chore: P2 final verification"
git push origin main
```
