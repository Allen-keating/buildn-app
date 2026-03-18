import { create } from 'zustand'
import type { ChatMessage, FileMap, FileTreeNode, FileOperation, SandboxStatus } from '@buildn/shared'

interface AppStore {
  projectId: string | null
  projectName: string
  files: FileMap
  fileTree: FileTreeNode[]
  setProject: (id: string, name: string, files: FileMap) => void

  messages: ChatMessage[]
  isGenerating: boolean
  addMessage: (message: ChatMessage) => void
  updateLastAssistant: (update: Partial<ChatMessage>) => void
  setIsGenerating: (v: boolean) => void

  openFiles: string[]
  activeFilePath: string | null
  openFile: (path: string) => void
  closeFile: (path: string) => void
  setActiveFile: (path: string | null) => void

  sandboxStatus: SandboxStatus
  previewUrl: string | null
  setSandboxStatus: (status: SandboxStatus) => void
  setPreviewUrl: (url: string | null) => void

  applyFileOperations: (ops: FileOperation[]) => void

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

export const useAppStore = create<AppStore>((set) => ({
  projectId: null,
  projectName: '',
  files: {},
  fileTree: [],
  setProject: (id, name, files) =>
    set({ projectId: id, projectName: name, files, fileTree: buildTreeFromPaths(Object.keys(files)) }),

  messages: [],
  isGenerating: false,
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  updateLastAssistant: (update) =>
    set((s) => {
      const msgs = [...s.messages]
      const last = [...msgs].reverse().find((m: ChatMessage) => m.role === 'assistant')
      if (last) Object.assign(last, update)
      return { messages: msgs }
    }),
  setIsGenerating: (v) => set({ isGenerating: v }),

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

  sandboxStatus: 'idle',
  previewUrl: null,
  setSandboxStatus: (status) => set({ sandboxStatus: status }),
  setPreviewUrl: (url) => set({ previewUrl: url }),

  applyFileOperations: (ops) =>
    set((s) => {
      const files = { ...s.files }
      for (const op of ops) {
        if (op.type === 'delete') delete files[op.path]
        else if (op.content) files[op.path] = op.content
      }
      return { files, fileTree: buildTreeFromPaths(Object.keys(files)) }
    }),

  isDeploying: false,
  deployUrl: null,
  setDeploying: (v) => set({ isDeploying: v }),
  setDeployUrl: (url) => set({ deployUrl: url }),
}))
