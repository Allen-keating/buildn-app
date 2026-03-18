import { eq, and, inArray } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import { writeFileSync, readFileSync, mkdirSync, rmSync, readdirSync, statSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { db } from '../db'
import { deploys, projects } from '../db/schema'
import { getProjectFiles } from './project.service'
import { createSite, createDeploy, uploadFile, getNetlifyDeployStatus } from '../lib/netlify'

export async function startDeploy(projectId: string) {
  const active = await db.query.deploys.findFirst({
    where: and(
      eq(deploys.projectId, projectId),
      inArray(deploys.phase, ['queued', 'building', 'uploading']),
    ),
  })

  if (active) {
    return { error: 'A deployment is already in progress' }
  }

  const [deploy] = await db.insert(deploys).values({ projectId, phase: 'queued' }).returning()

  // Run deploy in background (non-blocking)
  runDeploy(deploy.id, projectId).catch(console.error)

  return { deploy }
}

async function runDeploy(deployId: string, projectId: string) {
  const dir = join(tmpdir(), `buildn-deploy-${randomUUID()}`)

  try {
    await updatePhase(deployId, 'building')

    const projectFiles = await getProjectFiles(projectId)
    mkdirSync(dir, { recursive: true })

    for (const [path, content] of Object.entries(projectFiles)) {
      const fullPath = join(dir, path)
      mkdirSync(join(fullPath, '..'), { recursive: true })
      writeFileSync(fullPath, content)
    }

    execSync('npm install --ignore-scripts 2>/dev/null', {
      cwd: dir,
      stdio: 'pipe',
      timeout: 60000,
    })
    execSync('npx vite build', { cwd: dir, stdio: 'pipe', timeout: 60000 })

    const distDir = join(dir, 'dist')

    await updatePhase(deployId, 'uploading')

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    })
    let siteId = project?.netlifySiteId

    if (!siteId) {
      const site = await createSite(project?.name ?? 'buildn-app')
      siteId = site.id
      await db.update(projects).set({ netlifySiteId: siteId }).where(eq(projects.id, projectId))
    }

    const distFiles = collectFiles(distDir, '')
    const digests: Record<string, string> = {}
    for (const [path, fullPath] of Object.entries(distFiles)) {
      const content = readFileSync(fullPath)
      digests[`/${path}`] = createHash('sha1').update(content).digest('hex')
    }

    const netlifyDeploy = await createDeploy(siteId, digests)
    await db
      .update(deploys)
      .set({ netlifyDeployId: netlifyDeploy.id })
      .where(eq(deploys.id, deployId))

    for (const requiredPath of netlifyDeploy.required) {
      const localPath = distFiles[requiredPath.slice(1)]
      if (localPath) {
        await uploadFile(netlifyDeploy.id, requiredPath, readFileSync(localPath))
      }
    }

    let status = await getNetlifyDeployStatus(netlifyDeploy.id)
    let attempts = 0
    while (status.state !== 'ready' && status.state !== 'error' && attempts < 30) {
      await new Promise((r) => setTimeout(r, 2000))
      status = await getNetlifyDeployStatus(netlifyDeploy.id)
      attempts++
    }

    if (status.state === 'ready') {
      await db
        .update(deploys)
        .set({ phase: 'ready', url: status.url, completedAt: new Date() })
        .where(eq(deploys.id, deployId))
      await db
        .update(projects)
        .set({ deployUrl: status.url, status: 'published' })
        .where(eq(projects.id, projectId))
    } else {
      await updatePhase(deployId, 'failed', `Deploy did not become ready: ${status.state}`)
    }
  } catch (err) {
    await updatePhase(deployId, 'failed', String(err))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

async function updatePhase(deployId: string, phase: string, error?: string) {
  await db
    .update(deploys)
    .set({
      phase,
      ...(error ? { error } : {}),
      ...(phase === 'ready' || phase === 'failed' ? { completedAt: new Date() } : {}),
    })
    .where(eq(deploys.id, deployId))
}

function collectFiles(dir: string, prefix: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const relativePath = prefix ? `${prefix}/${entry}` : entry
    if (statSync(fullPath).isDirectory()) {
      Object.assign(result, collectFiles(fullPath, relativePath))
    } else {
      result[relativePath] = fullPath
    }
  }
  return result
}

export async function getDeployStatusForProject(projectId: string) {
  const deploy = await db.query.deploys.findFirst({
    where: eq(deploys.projectId, projectId),
    orderBy: (d, { desc }) => [desc(d.startedAt)],
  })

  if (!deploy) return null

  return {
    phase: deploy.phase,
    url: deploy.url,
    error: deploy.error,
    startedAt: deploy.startedAt,
    completedAt: deploy.completedAt,
  }
}
