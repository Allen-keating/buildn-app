'use client'

interface FileTabsProps {
  openFiles: string[]
  activePath: string | null
  onSelect: (path: string) => void
  onClose: (path: string) => void
}

export function FileTabs({ openFiles, activePath, onSelect, onClose }: FileTabsProps) {
  if (openFiles.length === 0) return null
  return (
    <div className="flex overflow-x-auto border-b border-neutral-800 bg-neutral-950">
      {openFiles.map((path) => {
        const name = path.split('/').pop() ?? path
        const isActive = path === activePath
        return (
          <div key={path} onClick={() => onSelect(path)} className={`flex cursor-pointer items-center gap-1 border-r border-neutral-800 px-3 py-1.5 text-xs ${isActive ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>
            <span>{name}</span>
            <button onClick={(e) => { e.stopPropagation(); onClose(path) }} className="ml-1 text-neutral-600 hover:text-white">&times;</button>
          </div>
        )
      })}
    </div>
  )
}
