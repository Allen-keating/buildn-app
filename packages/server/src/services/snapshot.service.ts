import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db'
import { snapshots, files } from '../db/schema'
import type { FileMap } from '@buildn/shared'

export async function listSnapshots(projectId: string) {
  const rows = await db.query.snapshots.findMany({
    where: eq(snapshots.projectId, projectId),
    orderBy: [desc(snapshots.createdAt)],
    columns: {
      id: true,
      messageId: true,
      description: true,
      createdAt: true,
      files: true,
    },
  })

  return rows.map((s) => ({
    id: s.id,
    messageId: s.messageId,
    description: s.description,
    fileCount: Object.keys(s.files as Record<string, string>).length,
    createdAt: s.createdAt,
  }))
}

export async function restoreSnapshot(projectId: string, snapshotId: string) {
  const snapshot = await db.query.snapshots.findFirst({
    where: and(eq(snapshots.id, snapshotId), eq(snapshots.projectId, projectId)),
  })

  if (!snapshot) return null

  const snapshotFiles = snapshot.files as FileMap

  await db.transaction(async (tx) => {
    // Delete all current files
    await tx.delete(files).where(eq(files.projectId, projectId))

    // Insert snapshot files
    const entries = Object.entries(snapshotFiles)
    if (entries.length > 0) {
      await tx.insert(files).values(
        entries.map(([path, content]) => ({
          projectId,
          path,
          content,
        })),
      )
    }
  })

  return snapshotFiles
}
