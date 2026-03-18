import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAppStore } from '../stores/app-store'
import { useChat } from '../hooks/use-chat'
import { api } from '../lib/api'
import { bootSandbox, installDeps, startDevServer } from '../lib/sandbox'
import { Header } from '../components/layout/Header'
import { StatusBar } from '../components/layout/StatusBar'
import { AppShell } from '../components/layout/AppShell'
import { FileTree } from '../components/editor/FileTree'
import { FileTabs } from '../components/editor/FileTabs'
import { CodeEditor } from '../components/editor/CodeEditor'
import { ChatPanel } from '../components/chat/ChatPanel'
import { PreviewPanel } from '../components/preview/PreviewPanel'

export function Workspace() {
  const { id } = useParams<{ id: string }>()
  const store = useAppStore()
  const { sendMessage } = useChat()

  useEffect(() => {
    if (!id) return

    async function loadProject() {
      const { project, files } = await api.getProject(id!)
      const p = project as { id: string; name: string }
      store.setProject(p.id, p.name, files)

      // Boot sandbox
      store.setSandboxStatus('booting')
      try {
        const wc = await bootSandbox(files)
        store.setSandboxStatus('installing')
        await installDeps(wc)
        store.setSandboxStatus('running')
        await startDevServer(wc, (url) => {
          store.setPreviewUrl(url)
        })
      } catch {
        store.setSandboxStatus('error')
      }
    }

    loadProject()
  }, [id])

  const activeFile = store.activeFilePath
    ? { path: store.activeFilePath, content: store.files[store.activeFilePath] ?? '' }
    : null

  return (
    <div className="flex h-screen flex-col bg-neutral-950 text-white">
      <Header projectName={store.projectName} onPublish={() => {}} />
      <AppShell
        sidebar={
          <FileTree
            tree={store.fileTree}
            selectedPath={store.activeFilePath}
            onSelect={(path) => store.openFile(path)}
          />
        }
        main={
          <div className="flex h-full flex-col">
            <FileTabs
              openFiles={store.openFiles}
              activePath={store.activeFilePath}
              onSelect={(path) => store.setActiveFile(path)}
              onClose={(path) => store.closeFile(path)}
            />
            {store.openFiles.length > 0 ? (
              <CodeEditor file={activeFile} />
            ) : (
              <ChatPanel
                messages={store.messages}
                onSendMessage={sendMessage}
                isGenerating={store.isGenerating}
                onFileClick={(path) => store.openFile(path)}
              />
            )}
          </div>
        }
        preview={
          <PreviewPanel
            url={store.previewUrl}
            isLoading={store.sandboxStatus === 'booting' || store.sandboxStatus === 'installing'}
          />
        }
      />
      <StatusBar
        sandboxStatus={store.sandboxStatus}
        fileCount={Object.keys(store.files).length}
      />
    </div>
  )
}
