'use client'

import Link from 'next/link'
import { Group, Panel, Separator } from 'react-resizable-panels'
import type { Project } from '@buildn/shared'

export function WorkspaceShell({ project }: { project: Project }) {
  return (
    <div className="flex h-screen flex-col bg-neutral-950 text-white">
      <div className="flex h-11 items-center justify-between border-b border-neutral-800 px-4">
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="font-bold">造</Link>
          <span className="text-neutral-600">/</span>
          <span className="text-sm text-neutral-400">{project.name}</span>
        </div>
        <div className="flex gap-2">
          <button className="rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-400 hover:text-white">
            Share
          </button>
          <button className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-500">
            Publish
          </button>
        </div>
      </div>

      <Group orientation="horizontal" className="flex-1">
        <Panel defaultSize={15} minSize={10} maxSize={25}>
          <div className="flex h-full flex-col border-r border-neutral-800">
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
              Files
            </div>
            <div className="flex flex-1 items-center justify-center text-xs text-neutral-600">
              Coming in P4
            </div>
          </div>
        </Panel>
        <Separator className="w-px bg-neutral-800 hover:bg-blue-600" />
        <Panel defaultSize={42} minSize={25}>
          <div className="flex h-full flex-col">
            <div className="flex border-b border-neutral-800">
              <div className="border-b-2 border-blue-500 px-4 py-2 text-xs text-white">Chat</div>
              <div className="px-4 py-2 text-xs text-neutral-600">Code</div>
            </div>
            <div className="flex flex-1 items-center justify-center text-xs text-neutral-600">
              Coming in P3
            </div>
          </div>
        </Panel>
        <Separator className="w-px bg-neutral-800 hover:bg-blue-600" />
        <Panel defaultSize={43} minSize={20}>
          <div className="flex h-full items-center justify-center bg-neutral-900 text-xs text-neutral-600">
            Coming in P2
          </div>
        </Panel>
      </Group>

      <div className="flex h-6 items-center gap-4 border-t border-neutral-800 px-4 text-[10px] text-neutral-600">
        <span>Ready</span>
        <span>0 files</span>
      </div>
    </div>
  )
}
