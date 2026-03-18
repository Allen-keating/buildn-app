import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateCode } from '@buildn/ai-engine'
import type { GenerateEvent, FileOperation, ConversationMessage } from '@buildn/shared'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { projectId, prompt } = await request.json() as { projectId: string; prompt: string }
  if (!projectId || !prompt) return new Response('Missing projectId or prompt', { status: 400 })

  // Verify project ownership (RLS handles this but check anyway)
  const { data: project } = await supabase.from('projects').select('id').eq('id', projectId).single()
  if (!project) return new Response('Project not found', { status: 404 })

  // Load project files
  const { data: fileRows } = await supabase.from('files').select('path, content').eq('project_id', projectId)
  const projectFiles: Record<string, string> = {}
  for (const row of fileRows ?? []) {
    projectFiles[row.path] = row.content
  }

  // Load conversation history (last 20)
  const { data: messageRows } = await supabase
    .from('messages')
    .select('role, content')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(20)
  const conversationHistory: ConversationMessage[] = (messageRows ?? []).reverse().map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  // Save user message
  await supabase.from('messages').insert({ project_id: projectId, role: 'user', content: prompt })

  // Stream SSE
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let fullContent = ''
      const allFileOps: FileOperation[] = []

      await generateCode(
        { prompt, projectFiles, conversationHistory },
        (event: GenerateEvent) => {
          if (event.type === 'token') fullContent += event.text
          if (event.type === 'file_operation') allFileOps.push(event.operation)

          controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`))

          if (event.type === 'done') {
            // Save assistant message + apply file operations
            saveResult(supabase, projectId, fullContent, allFileOps).catch(console.error)
          }
        },
      )

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

async function saveResult(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  content: string,
  fileOps: FileOperation[],
) {
  // Save assistant message
  const { data: msg } = await supabase
    .from('messages')
    .insert({ project_id: projectId, role: 'assistant', content, file_ops: fileOps })
    .select('id')
    .single()

  // Apply file operations
  for (const op of fileOps) {
    if (op.type === 'delete') {
      await supabase.from('files').delete().eq('project_id', projectId).eq('path', op.path)
    } else if (op.content) {
      await supabase.from('files').upsert(
        { project_id: projectId, path: op.path, content: op.content, updated_at: new Date().toISOString() },
        { onConflict: 'project_id,path' },
      )
    }
  }

  // Save snapshot
  const { data: allFiles } = await supabase.from('files').select('path, content').eq('project_id', projectId)
  const fileMap: Record<string, string> = {}
  for (const f of allFiles ?? []) fileMap[f.path] = f.content

  await supabase.from('snapshots').insert({
    project_id: projectId,
    message_id: msg?.id,
    description: `AI: ${fileOps.length} file(s) changed`,
    files: fileMap,
  })
}
