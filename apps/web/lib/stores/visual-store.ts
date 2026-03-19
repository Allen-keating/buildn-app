'use client'

import { create } from 'zustand'

export interface SelectedElement {
  tag: string
  text: string
  classes: string
  selector: string
  rect: { top: number; left: number; width: number; height: number }
}

interface VisualStore {
  isVisualEditMode: boolean
  selectedElement: SelectedElement | null
  toggleVisualEdit: () => void
  setVisualEdit: (enabled: boolean) => void
  selectElement: (element: SelectedElement) => void
  clearSelection: () => void
}

export const useVisualStore = create<VisualStore>((set) => ({
  isVisualEditMode: false,
  selectedElement: null,
  toggleVisualEdit: () =>
    set((s) => ({
      isVisualEditMode: !s.isVisualEditMode,
      selectedElement: s.isVisualEditMode ? null : s.selectedElement,
    })),
  setVisualEdit: (enabled) =>
    set({ isVisualEditMode: enabled, ...(!enabled ? { selectedElement: null } : {}) }),
  selectElement: (element) => set({ selectedElement: element }),
  clearSelection: () => set({ selectedElement: null }),
}))
