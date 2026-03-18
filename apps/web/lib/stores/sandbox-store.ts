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
