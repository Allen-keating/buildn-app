import { eq, and, sql } from 'drizzle-orm'
import { db } from '../db'
import { projects, files } from '../db/schema'
import type { FileMap } from '@buildn/shared'

const PROJECT_LIMITS = { free: 5, pro: 50, team: 200 } as const

export async function listProjects(userId: string) {
  return db.query.projects.findMany({
    where: eq(projects.userId, userId),
    orderBy: (p, { desc }) => [desc(p.updatedAt)],
  })
}

export async function getProject(projectId: string, userId: string) {
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  })
  return project ?? null
}

export async function getProjectFiles(projectId: string): Promise<FileMap> {
  const rows = await db.query.files.findMany({
    where: eq(files.projectId, projectId),
  })
  const fileMap: FileMap = {}
  for (const row of rows) {
    fileMap[row.path] = row.content
  }
  return fileMap
}

export async function createProject(
  userId: string,
  userPlan: string,
  data: { name: string; description?: string; template?: string },
) {
  const limit = PROJECT_LIMITS[userPlan as keyof typeof PROJECT_LIMITS] ?? 5
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(projects)
    .where(eq(projects.userId, userId))

  if (count >= limit) {
    return { error: `Project limit reached (${limit} for ${userPlan} plan)` }
  }

  const [project] = await db
    .insert(projects)
    .values({
      userId,
      name: data.name,
      description: data.description ?? '',
      template: data.template ?? 'blank',
    })
    .returning()

  return { project }
}

export async function updateProject(
  projectId: string,
  userId: string,
  data: { name?: string; description?: string },
) {
  const [project] = await db
    .update(projects)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .returning()

  return project ?? null
}

export async function deleteProject(projectId: string, userId: string) {
  const result = await db
    .delete(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .returning({ id: projects.id })

  return result.length > 0
}
