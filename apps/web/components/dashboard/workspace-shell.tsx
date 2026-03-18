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
              <div className="border-b-2 border-blue-500 px-4 py-2 text-xs text-white">Chat</div>
              <div className="px-4 py-2 text-xs text-neutral-600">Code</div>
            </div>
            <div className="flex flex-1 items-center justify-center text-xs text-neutral-600">Coming in P3</div>
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
  const labels: Record<typeof status, string> = { idle: 'Idle', booting: 'Starting...', installing: 'Installing...', running: 'Running', error: 'Error' }
  const colors: Record<typeof status, string> = { idle: 'text-neutral-600', booting: 'text-yellow-500', installing: 'text-yellow-500', running: 'text-green-500', error: 'text-red-500' }
  return <span className={colors[status]}>{labels[status]}</span>
}
