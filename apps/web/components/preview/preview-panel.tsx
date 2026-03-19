'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSandboxStore, type SandboxStatus } from '@/lib/stores/sandbox-store'
import { useVisualStore, type SelectedElement } from '@/lib/stores/visual-store'
import { DeviceFrame, SIZES, type DeviceType } from './device-frame'
import { SelectionOverlay } from './selection-overlay'

const STATUS_MESSAGES: Record<SandboxStatus, string> = {
  idle: 'Waiting...',
  booting: 'Starting sandbox...',
  installing: 'Installing dependencies...',
  running: '',
  error: 'Something went wrong',
}

export function PreviewPanel() {
  const { status, previewUrl, error } = useSandboxStore()
  const { isVisualEditMode, toggleVisualEdit, selectElement } = useVisualStore()
  const [device, setDevice] = useState<DeviceType>('desktop')
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const iframe = iframeRef.current
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'buildn:visual-edit', enabled: isVisualEditMode }, '*')
    }
  }, [isVisualEditMode])

  const handleMessage = useCallback((e: MessageEvent) => {
    if (e.data?.type === 'buildn:element-selected') {
      selectElement(e.data.payload as SelectedElement)
    }
  }, [selectElement])

  useEffect(() => {
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [handleMessage])

  const handleIframeLoad = useCallback(() => {
    if (isVisualEditMode && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'buildn:visual-edit', enabled: true }, '*')
    }
  }, [isVisualEditMode])

  return (
    <div className="relative flex h-full flex-col bg-neutral-900">
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-1.5">
        <DeviceFrame device={device} onDeviceChange={setDevice} />
        <button
          onClick={toggleVisualEdit}
          className={`rounded px-2 py-0.5 text-xs ${isVisualEditMode ? 'bg-blue-600 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
          title="Visual Edit Mode"
        >
          {isVisualEditMode ? '✎ Editing' : '✎ Edit'}
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-2">
        {status === 'running' && previewUrl ? (
          <>
            <iframe
              ref={iframeRef}
              src={previewUrl}
              title="Preview"
              className="rounded border border-neutral-700 bg-white"
              style={{ width: SIZES[device].width, height: '100%', maxWidth: '100%' }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              onLoad={handleIframeLoad}
            />
            <SelectionOverlay />
          </>
        ) : (
          <div className="text-center">
            {(status === 'booting' || status === 'installing') && (
              <div className="mb-2 mx-auto h-5 w-5 animate-spin rounded-full border-2 border-neutral-600 border-t-blue-500" />
            )}
            <p className="text-sm text-neutral-500">{error || STATUS_MESSAGES[status]}</p>
            {status === 'idle' && (
              <p className="mt-1 text-xs text-neutral-600">Send a message to generate code and see the preview</p>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="absolute bottom-0 left-0 right-0 border-t border-red-900 bg-red-950/90 px-4 py-2">
          <p className="text-xs text-red-400">{error}</p>
          <button onClick={() => useSandboxStore.getState().setError(null)} className="mt-1 text-xs text-red-500 hover:text-red-300">Dismiss</button>
        </div>
      )}
    </div>
  )
}
