import type { SandboxStatus } from '@buildn/shared'

const STATUS_LABELS: Record<SandboxStatus, string> = {
  idle: 'Idle',
  booting: 'Starting...',
  installing: 'Installing...',
  running: 'Running',
  building: 'Building...',
  error: 'Error',
}

interface StatusBarProps {
  sandboxStatus: SandboxStatus
  fileCount: number
}

export function StatusBar({ sandboxStatus, fileCount }: StatusBarProps) {
  return (
    <footer className="flex h-6 items-center gap-4 border-t border-neutral-800 bg-neutral-950 px-4 text-xs text-neutral-500">
      <span>{STATUS_LABELS[sandboxStatus]}</span>
      <span>{fileCount} files</span>
    </footer>
  )
}
