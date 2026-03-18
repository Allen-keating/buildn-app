import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db'
import { messages, files, snapshots } from '../db/schema'
import { generateCode } from '@buildn/ai-engine'
import { getProjectFiles } from './project.service'
import type { ConversationMessage, FileOperation } from '@buildn/shared'

const MAX_HISTORY = 20

export async function getConversationHistory(projectId: string): Promise<ConversationMessage[]> {
  const rows = await db.query.messages.findMany({
    where: eq(messages.projectId, projectId),
    orderBy: [desc(messages.createdAt)],
    limit: MAX_HISTORY,
  })

  return rows.reverse().map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))
}

export async function saveUserMessage(projectId: string, content: string) {
  const [msg] = await db.insert(messages).values({ projectId, role: 'user', content }).returning()
  return msg
}

export async function saveAssistantMessage(
  projectId: string,
  content: string,
  fileOps: FileOperation[],
) {
  return db.transaction(async (tx) => {
    // Save assistant message
    const [msg] = await tx
      .insert(messages)
      .values({ projectId, role: 'assistant', content, fileOperations: fileOps })
      .returning()

    // Apply file operations
    for (const op of fileOps) {
      if (op.type === 'delete') {
        await tx.delete(files).where(and(eq(files.projectId, projectId), eq(files.path, op.path)))
      } else {
        await tx
          .insert(files)
          .values({ projectId, path: op.path, content: op.content ?? '' })
          .onConflictDoUpdate({
            target: [files.projectId, files.path],
            set: { content: op.content ?? '', updatedAt: new Date() },
          })
      }
    }

    // Create snapshot
    const allFiles = await getProjectFiles(projectId)
    await tx.insert(snapshots).values({
      projectId,
      messageId: msg.id,
      description: `AI update: ${fileOps.length} file(s) changed`,
      files: allFiles,
    })

    return msg
  })
}

export async function* streamChat(projectId: string, prompt: string) {
  const projectFiles = await getProjectFiles(projectId)
  const history = await getConversationHistory(projectId)

  await saveUserMessage(projectId, prompt)

  const stream = generateCode({
    prompt,
    projectFiles,
    conversationHistory: history,
  })

  let fullContent = ''
  const allFileOps: FileOperation[] = []

  for await (const event of stream) {
    if (event.type === 'token') {
      fullContent += event.text
    }
    if (event.type === 'file_operation') {
      allFileOps.push(event.operation)
    }
    if (event.type === 'done') {
      await saveAssistantMessage(projectId, fullContent, allFileOps)
    }
    yield event
  }
}
