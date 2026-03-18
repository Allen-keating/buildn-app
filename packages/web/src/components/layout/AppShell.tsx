import { Group, Panel, Separator } from 'react-resizable-panels'
import type { ReactNode } from 'react'

interface AppShellProps {
  sidebar: ReactNode
  main: ReactNode
  preview: ReactNode
}

export function AppShell({ sidebar, main, preview }: AppShellProps) {
  return (
    <Group orientation="horizontal" className="flex-1">
      <Panel defaultSize={15} minSize={10} maxSize={25}>
        <div className="h-full overflow-auto border-r border-neutral-800 bg-neutral-950">
          {sidebar}
        </div>
      </Panel>
      <Separator className="w-1 bg-neutral-800 transition-colors hover:bg-blue-600" />
      <Panel defaultSize={42} minSize={25}>
        <div className="h-full overflow-hidden bg-neutral-950">{main}</div>
      </Panel>
      <Separator className="w-1 bg-neutral-800 transition-colors hover:bg-blue-600" />
      <Panel defaultSize={43} minSize={20}>
        <div className="h-full overflow-hidden bg-neutral-900">{preview}</div>
      </Panel>
    </Group>
  )
}
