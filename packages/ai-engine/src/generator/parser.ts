import type { FileMap, FileOperation } from '@buildn/shared'

const FILE_REGEX = /---FILE:\s*(.+?)---\n([\s\S]*?)---END FILE---/g

export function parseFileOperations(llmOutput: string, existingFiles: FileMap): FileOperation[] {
  const operations: FileOperation[] = []
  let match: RegExpExecArray | null

  FILE_REGEX.lastIndex = 0

  while ((match = FILE_REGEX.exec(llmOutput)) !== null) {
    const path = match[1].trim()
    const content = match[2].trimEnd()

    if (path in existingFiles) {
      operations.push({ type: 'modify', path, content })
    } else {
      operations.push({ type: 'create', path, content })
    }
  }

  // Fallback: try to parse fenced code blocks
  if (operations.length === 0) {
    const codeBlockRegex = /```(?:tsx?|jsx?|css|json|html)\n\/\/\s*(.+?)\n([\s\S]*?)```/g
    while ((match = codeBlockRegex.exec(llmOutput)) !== null) {
      const path = match[1].trim()
      const content = match[2].trimEnd()
      const type = path in existingFiles ? 'modify' : 'create'
      operations.push({ type, path, content })
    }
  }

  return operations
}
