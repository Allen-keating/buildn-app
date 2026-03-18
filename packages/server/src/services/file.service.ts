import { eq, and } from 'drizzle-orm'
import { db } from '../db'
import { files } from '../db/schema'
import type { FileTreeNode } from '@buildn/shared'

function validatePath(path: string): boolean {
  if (!path || path.includes('..') || path.startsWith('/')) return false
  if (/[<>:"|?*\x00-\x1f]/.test(path)) return false
  return true
}

function buildTree(filePaths: string[]): FileTreeNode[] {
  const root: FileTreeNode[] = []

  for (const filePath of filePaths.sort()) {
    const parts = filePath.split('/')
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]
      const isFile = i === parts.length - 1
      const currentPath = parts.slice(0, i + 1).join('/')

      let node = current.find((n) => n.name === name)
      if (!node) {
        node = {
          name,
          path: currentPath,
          type: isFile ? 'file' : 'directory',
          ...(isFile ? {} : { children: [] }),
        }
        current.push(node)
      }

      if (!isFile) current = node.children!
    }
  }

  return root
}

export async function listFiles(projectId: string): Promise<FileTreeNode[]> {
  const rows = await db.query.files.findMany({
    where: eq(files.projectId, projectId),
    columns: { path: true },
  })
  return buildTree(rows.map((r) => r.path))
}

export async function readFile(projectId: string, path: string) {
  if (!validatePath(path)) return { error: 'Invalid file path' }

  const file = await db.query.files.findFirst({
    where: and(eq(files.projectId, projectId), eq(files.path, path)),
  })
  return file ? { path: file.path, content: file.content } : null
}

export async function writeFile(projectId: string, path: string, content: string) {
  if (!validatePath(path)) return { error: 'Invalid file path' }

  const [file] = await db
    .insert(files)
    .values({ projectId, path, content })
    .onConflictDoUpdate({
      target: [files.projectId, files.path],
      set: { content, updatedAt: new Date() },
    })
    .returning()

  return { file }
}

export async function deleteFile(projectId: string, path: string) {
  if (!validatePath(path)) return { error: 'Invalid file path' }

  const result = await db
    .delete(files)
    .where(and(eq(files.projectId, projectId), eq(files.path, path)))
    .returning({ id: files.id })

  return result.length > 0
}
