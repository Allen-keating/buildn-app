'use client'

import { useVisualStore } from '@/lib/stores/visual-store'

export function SelectionOverlay() {
  const { selectedElement, isVisualEditMode } = useVisualStore()

  if (!isVisualEditMode || !selectedElement) return null

  return (
    <div className="pointer-events-none absolute left-2 top-12 z-20">
      <div className="pointer-events-auto rounded-md bg-blue-600 px-2 py-1 text-xs text-white shadow-lg">
        <span className="font-mono">&lt;{selectedElement.tag}&gt;</span>
        {selectedElement.text && (
          <span className="ml-1 text-blue-200">
            &ldquo;{selectedElement.text.slice(0, 30)}
            {selectedElement.text.length > 30 ? '...' : ''}&rdquo;
          </span>
        )}
        <button
          onClick={() => useVisualStore.getState().clearSelection()}
          className="ml-2 text-blue-300 hover:text-white"
        >
          &times;
        </button>
      </div>
    </div>
  )
}
