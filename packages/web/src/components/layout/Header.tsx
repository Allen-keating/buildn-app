interface HeaderProps {
  projectName: string
  onPublish: () => void
}

export function Header({ projectName, onPublish }: HeaderProps) {
  return (
    <header className="flex h-12 items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4">
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold text-white">造</span>
        <span className="text-sm text-neutral-400">{projectName}</span>
      </div>
      <button
        onClick={onPublish}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
      >
        Publish
      </button>
    </header>
  )
}
