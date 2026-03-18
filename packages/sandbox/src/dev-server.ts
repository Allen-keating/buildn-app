import type { WebContainer, WebContainerProcess } from '@webcontainer/api'

export async function installDeps(wc: WebContainer): Promise<number> {
  const process = await wc.spawn('npm', ['install'])
  process.output.pipeTo(new WritableStream({ write(chunk) { console.log('[npm]', chunk) } })).catch(() => {})
  return process.exit
}

export async function startDevServer(
  wc: WebContainer,
  onReady: (url: string) => void,
  onError?: (error: string) => void,
): Promise<WebContainerProcess> {
  const process = await wc.spawn('npm', ['run', 'dev'])
  process.output.pipeTo(new WritableStream({ write(chunk) { console.log('[vite]', chunk) } })).catch(() => {})
  wc.on('server-ready', (_port, url) => { onReady(url) })
  wc.on('error', (err) => { onError?.(err.message) })
  return process
}
