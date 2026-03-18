import { useState } from 'react'
import type { FileTreeNode } from '@buildn/shared'

interface FileTreeProps {
  tree: FileTreeNode[]
  selectedPath: string | null
  onSelect: (path: string) => void
  changedPaths?: string[]
}

function TreeNode({
  node,
  depth,
  selectedPath,
  onSelect,
  changedPaths,
}: {
  node: FileTreeNode
  depth: number
  selectedPath: string | null
  onSelect: (p: string) => void
  changedPaths?: string[]
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const isChanged = changedPaths?.includes(node.path)
  const isSelected = selectedPath === node.path

  if (node.type === 'directory') {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-1 px-2 py-0.5 text-xs text-neutral-400 hover:bg-neutral-800"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <span>{expanded ? '\u25BC' : '\u25B6'}</span>
          <span>{node.name}</span>
        </button>
        {expanded &&
          node.children?.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              changedPaths={changedPaths}
            />
          ))}
      </div>
    )
  }

  return (
    <button
      onClick={() => onSelect(node.path)}
      className={`flex w-full items-center gap-1 px-2 py-0.5 text-xs ${isSelected ? 'bg-blue-600/20 text-blue-400' : 'text-neutral-300 hover:bg-neutral-800'}`}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <span>{node.name}</span>
      {isChanged && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-yellow-500" />}
    </button>
  )
}

export function FileTree({ tree, selectedPath, onSelect, changedPaths }: FileTreeProps) {
  return (
    <div className="py-2">
      <p className="px-3 pb-2 text-xs font-semibold uppercase text-neutral-500">Files</p>
      {tree.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
          changedPaths={changedPaths}
        />
      ))}
    </div>
  )
}
