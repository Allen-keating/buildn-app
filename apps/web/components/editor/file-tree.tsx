'use client'

import { useState } from 'react'
import type { FileMap } from '@buildn/shared'

interface FileTreeProps {
  files: FileMap
  activeFilePath: string | null
  onSelectFile: (path: string) => void
}

interface TreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: TreeNode[]
}

function buildTree(files: FileMap): TreeNode[] {
  const root: TreeNode[] = []
  for (const filePath of Object.keys(files).sort()) {
    const parts = filePath.split('/')
    let current = root
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]
      const isFile = i === parts.length - 1
      const currentPath = parts.slice(0, i + 1).join('/')
      let node = current.find((n) => n.name === name)
      if (!node) {
        node = { name, path: currentPath, type: isFile ? 'file' : 'directory', ...(isFile ? {} : { children: [] }) }
        current.push(node)
      }
      if (!isFile) current = node.children!
    }
  }
  return root
}

function TreeNodeItem({ node, depth, activeFilePath, onSelectFile }: { node: TreeNode; depth: number; activeFilePath: string | null; onSelectFile: (path: string) => void }) {
  const [expanded, setExpanded] = useState(depth < 2)
  const isActive = activeFilePath === node.path

  if (node.type === 'directory') {
    return (
      <div>
        <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center gap-1 py-0.5 text-xs text-neutral-400 hover:bg-neutral-800" style={{ paddingLeft: `${depth * 12 + 8}px` }}>
          <span className="text-[10px]">{expanded ? '\u25BC' : '\u25B6'}</span>
          <span>{node.name}</span>
        </button>
        {expanded && node.children?.map((child) => (
          <TreeNodeItem key={child.path} node={child} depth={depth + 1} activeFilePath={activeFilePath} onSelectFile={onSelectFile} />
        ))}
      </div>
    )
  }

  return (
    <button onClick={() => onSelectFile(node.path)} className={`flex w-full items-center py-0.5 text-xs ${isActive ? 'bg-blue-600/20 text-blue-400' : 'text-neutral-300 hover:bg-neutral-800'}`} style={{ paddingLeft: `${depth * 12 + 20}px` }}>
      <span>{node.name}</span>
    </button>
  )
}

export function FileTree({ files, activeFilePath, onSelectFile }: FileTreeProps) {
  const tree = buildTree(files)
  if (Object.keys(files).length === 0) {
    return <div className="flex flex-1 items-center justify-center p-4 text-xs text-neutral-600">No files yet</div>
  }
  return (
    <div className="flex-1 overflow-y-auto py-1">
      {tree.map((node) => (
        <TreeNodeItem key={node.path} node={node} depth={0} activeFilePath={activeFilePath} onSelectFile={onSelectFile} />
      ))}
    </div>
  )
}
