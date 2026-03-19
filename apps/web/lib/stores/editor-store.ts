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
