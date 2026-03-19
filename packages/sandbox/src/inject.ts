import type { WebContainer } from '@webcontainer/api'
import { SELECTOR_SCRIPT } from './selector-script'

const INJECT_PATH = 'public/buildn-selector.js'

export async function injectSelectorScript(wc: WebContainer): Promise<void> {
  await wc.fs.mkdir('public', { recursive: true })
  await wc.fs.writeFile(INJECT_PATH, SELECTOR_SCRIPT)
}
