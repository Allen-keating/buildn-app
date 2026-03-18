import { useState } from 'react'
import { DeviceFrame, DEVICE_SIZES, type DeviceType } from './DeviceFrame'
import { ErrorOverlay } from './ErrorOverlay'

interface PreviewPanelProps {
  url: string | null
  isLoading: boolean
  error?: string | null
}

export function PreviewPanel({ url, isLoading, error }: PreviewPanelProps) {
  const [device, setDevice] = useState<DeviceType>('desktop')
  const [previewError, setPreviewError] = useState<string | null>(null)

  const displayError = error ?? previewError

  return (
    <div className="relative flex h-full flex-col">
      <DeviceFrame device={device} onDeviceChange={setDevice} />
      <div className="flex flex-1 items-center justify-center overflow-hidden p-2">
        {isLoading && <p className="text-sm text-neutral-500">Loading preview...</p>}
        {!isLoading && !url && (
          <p className="text-sm text-neutral-500">Send a message to see the preview</p>
        )}
        {url && (
          <iframe
            src={url}
            title="Preview"
            className="rounded border border-neutral-700 bg-white"
            style={{ width: DEVICE_SIZES[device].width, height: '100%', maxWidth: '100%' }}
            sandbox="allow-scripts allow-same-origin"
            onError={() => setPreviewError('Failed to load preview')}
          />
        )}
      </div>
      <ErrorOverlay error={displayError} onDismiss={() => setPreviewError(null)} />
    </div>
  )
}
