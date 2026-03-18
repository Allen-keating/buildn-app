import type { FileMap, FileOperation } from '@buildn/shared'

const FILE_RE = /---FILE:\s*(.+?)---\n([\s\S]*?)---END FILE---/g

function stripMarkdownFences(content: string): string {
  const trimmed = content.trim()
  const fenceMatch = trimmed.match(/^```\w*\n([\s\S]*?)\n?```$/)
  if (fenceMatch) return fenceMatch[1].trimEnd()
  return trimmed
}

export function parseFileOperations(llmOutput: string, existingFiles: FileMap): FileOperation[] {
  const operations: FileOperation[] = []
  FILE_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = FILE_RE.exec(llmOutput)) !== null) {
    const path = match[1].trim()
    const content = stripMarkdownFences(match[2])
    operations.push({
      type: path in existingFiles ? 'modify' : 'create',
      path,
      content,
    })
  }
  return operations
}
