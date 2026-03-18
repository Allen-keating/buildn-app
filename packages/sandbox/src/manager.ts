import { WebContainer } from '@webcontainer/api'
import type { FileMap } from '@buildn/shared'
import { fileMapToTree } from './files'

let instance: WebContainer | null = null

export async function bootSandbox(files: FileMap): Promise<WebContainer> {
  if (instance) { await instance.teardown(); instance = null }
  instance = await WebContainer.boot()
  const tree = fileMapToTree(files)
  await instance.mount(tree)
  return instance
}

export function getSandbox(): WebContainer | null { return instance }

export async function teardownSandbox(): Promise<void> {
  if (instance) { await instance.teardown(); instance = null }
}
