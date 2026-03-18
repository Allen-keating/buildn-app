/** Map of file paths to file contents */
export type FileMap = Record<string, string>

export interface FileOperation {
  type: 'create' | 'modify' | 'delete'
  path: string
  content?: string
  diff?: string
}

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}
