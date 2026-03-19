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
        <Panel defaultSize={15} minSize={10} maxSize={25}>
          <div className="flex h-full flex-col border-r border-neutral-800">
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">Files</div>
            <FileTree files={files} activeFilePath={activeFilePath} onSelectFile={handleFileSelect} />
          </div>
        </Panel>
        <Separator className="w-px bg-neutral-800 hover:bg-blue-600" />
        <Panel defaultSize={42} minSize={25}>
          <div className="flex h-full flex-col">
            <div className="flex border-b border-neutral-800">
              <button onClick={() => setActiveTab('chat')} className={`px-4 py-2 text-xs ${activeTab === 'chat' ? 'border-b-2 border-blue-500 text-white' : 'text-neutral-600 hover:text-neutral-400'}`}>Chat</button>
              <button onClick={() => setActiveTab('code')} className={`px-4 py-2 text-xs ${activeTab === 'code' ? 'border-b-2 border-blue-500 text-white' : 'text-neutral-600 hover:text-neutral-400'}`}>Code</button>
            </div>
            {activeTab === 'chat' ? (
              <ChatPanel projectId={project.id} currentFiles={files} onFilesChanged={setFiles} onFileClick={handleFileSelect} />
            ) : (
              <div className="flex flex-1 flex-col">
                <FileTabs openFiles={openFiles} activePath={activeFilePath} onSelect={setActiveFile} onClose={closeFile} />
                {activeFilePath ? (
                  <CodeEditor path={activeFilePath} content={activeFileContent} onChange={handleEditorChange} />
                ) : (
                  <div className="flex flex-1 items-center justify-center text-xs text-neutral-600">Select a file from the tree to edit</div>
                )}
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
