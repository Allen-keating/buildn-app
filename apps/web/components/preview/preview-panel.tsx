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
            style={{ width: SIZES[device].width, height: '100%', maxWidth: '100%' }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
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
