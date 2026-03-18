import { WebContainer } from '@webcontainer/api'
import type { FileMap } from '@buildn/shared'

let instance: WebContainer | null = null

export async function bootSandbox(files: FileMap): Promise<WebContainer> {
  if (instance) await instance.teardown()

  instance = await WebContainer.boot()
  const tree = fileMapToTree(files)
  await instance.mount(tree as Parameters<WebContainer['mount']>[0])
  return instance
}

export function getSandbox(): WebContainer | null {
  return instance
}

export async function writeFilesToSandbox(wc: WebContainer, files: FileMap) {
  for (const [path, content] of Object.entries(files)) {
    const dir = path.split('/').slice(0, -1).join('/')
    if (dir) await wc.fs.mkdir(dir, { recursive: true })
    await wc.fs.writeFile(path, content)
  }
}

export async function installDeps(wc: WebContainer): Promise<number> {
  const process = await wc.spawn('npm', ['install'])
  return process.exit
}

export async function startDevServer(wc: WebContainer, onReady: (url: string) => void) {
  const process = await wc.spawn('npm', ['run', 'dev'])

  wc.on('server-ready', (_port, url) => {
    onReady(url)
  })

  return process
}

function fileMapToTree(files: FileMap) {
  const tree: Record<string, unknown> = {}

  for (const [path, content] of Object.entries(files)) {
    const parts = path.split('/')
    let current = tree

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (i === parts.length - 1) {
        current[part] = { file: { contents: content } }
      } else {
        if (!current[part]) current[part] = { directory: {} }
        current = (current[part] as { directory: Record<string, unknown> }).directory
      }
    }
  }

  return tree
}
