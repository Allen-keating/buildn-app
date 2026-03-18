import type { FileMap } from '@buildn/shared'
import type { WebContainer, FileSystemTree } from '@webcontainer/api'

export function fileMapToTree(files: FileMap): FileSystemTree {
  const tree: FileSystemTree = {}
  for (const [path, content] of Object.entries(files)) {
    const parts = path.split('/')
    let current: any = tree
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (i === parts.length - 1) {
        current[part] = { file: { contents: content } }
      } else {
        if (!current[part]) current[part] = { directory: {} }
        current = current[part].directory
      }
    }
  }
  return tree
}

export async function writeFilesToContainer(wc: WebContainer, files: FileMap): Promise<void> {
  for (const [path, content] of Object.entries(files)) {
    const dir = path.split('/').slice(0, -1).join('/')
    if (dir) await wc.fs.mkdir(dir, { recursive: true })
    await wc.fs.writeFile(path, content)
  }
}

export function hasPackageJsonChanged(oldFiles: FileMap, newFiles: FileMap): boolean {
  return oldFiles['package.json'] !== newFiles['package.json']
}
