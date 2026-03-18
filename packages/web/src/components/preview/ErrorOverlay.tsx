interface ErrorOverlayProps {
  error: string | null
  onDismiss: () => void
}

export function ErrorOverlay({ error, onDismiss }: ErrorOverlayProps) {
  if (!error) return null

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 p-4">
      <div className="max-w-md rounded-lg border border-red-800 bg-red-950 p-4">
        <p className="text-sm font-medium text-red-300">Preview Error</p>
        <pre className="mt-2 whitespace-pre-wrap text-xs text-red-400">{error}</pre>
        <button
          onClick={onDismiss}
          className="mt-3 rounded bg-red-800 px-3 py-1 text-xs text-white hover:bg-red-700"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
