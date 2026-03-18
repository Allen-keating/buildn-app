import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WorkspaceShell } from '@/components/dashboard/workspace-shell'
import type { FileMap } from '@buildn/shared'

export default async function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: project } = await supabase.from('projects').select('*').eq('id', id).single()
  if (!project) redirect('/dashboard')

  const { data: fileRows } = await supabase.from('files').select('path, content').eq('project_id', id)
  const initialFiles: FileMap = {}
  for (const row of fileRows ?? []) initialFiles[row.path] = row.content

  return <WorkspaceShell project={project} initialFiles={initialFiles} />
}
