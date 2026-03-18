import type { FileMap } from '@buildn/shared'

export function selectRelevantFiles(
  files: FileMap,
  prompt: string,
): { key: string; content: string; priority: number }[] {
  const entries = Object.entries(files)

  return entries.map(([path, content]) => {
    let priority = 1

    if (path === 'src/App.tsx' || path === 'src/main.tsx' || path === 'package.json') {
      priority = 5
    }

    const fileName = path.split('/').pop() ?? ''
    if (prompt.toLowerCase().includes(fileName.toLowerCase().replace(/\.(tsx?|jsx?)$/, ''))) {
      priority = 10
    }

    return { key: path, content, priority }
  })
}

export function buildFileTree(files: FileMap): string {
  const paths = Object.keys(files).sort()
  return paths.map((p) => `  ${p}`).join('\n')
}
