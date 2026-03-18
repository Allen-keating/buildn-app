# Plan 5: Deploy Service — Netlify Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable one-click deployment of user projects to Netlify, with build pipeline and status tracking.

**Architecture:** DeployService receives a FileMap, writes to a temp directory, runs `vite build`, and uploads the `dist/` output via Netlify's REST API. Deployment status is tracked in the `deploys` database table.

**Tech Stack:** Netlify REST API, Node.js fs/child_process, Vite CLI

---

## File Structure

```
packages/server/src/
├── services/
│   └── deploy.service.ts            # Build + Netlify upload logic
├── lib/
│   └── netlify.ts                   # Netlify API client
└── routes/
    └── deploy.ts                    # POST /deploy, GET /deploy/status
```

---

## Task 1: Netlify API Client

**Files:**
- Create: `packages/server/src/lib/netlify.ts`

- [ ] **Step 1: Create netlify.ts**

```typescript
const NETLIFY_API = 'https://api.netlify.com/api/v1'

function getToken(): string {
  const token = process.env.NETLIFY_AUTH_TOKEN
  if (!token) throw new Error('NETLIFY_AUTH_TOKEN not set')
  return token
}

async function netlifyFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${NETLIFY_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Netlify API ${res.status}: ${text}`)
  }
  return res.json()
}

export async function createSite(name: string): Promise<{ id: string; url: string }> {
  const data = await netlifyFetch('/sites', {
    method: 'POST',
    body: JSON.stringify({ name: `buildn-${name}-${Date.now()}` }),
  })
  return { id: data.id, url: data.ssl_url || data.url }
}

export async function createDeploy(
  siteId: string,
  fileDigests: Record<string, string>,
): Promise<{ id: string; required: string[] }> {
  const data = await netlifyFetch(`/sites/${siteId}/deploys`, {
    method: 'POST',
    body: JSON.stringify({ files: fileDigests }),
  })
  return { id: data.id, required: data.required || [] }
}

export async function uploadFile(
  deployId: string,
  path: string,
  content: Buffer,
): Promise<void> {
  const res = await fetch(`${NETLIFY_API}/deploys/${deployId}/files/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/octet-stream',
    },
    body: content,
  })
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
}

export async function getDeployStatus(
  deployId: string,
): Promise<{ state: string; url: string }> {
  const data = await netlifyFetch(`/deploys/${deployId}`)
  return { state: data.state, url: data.ssl_url || data.url }
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
git add packages/server/src/lib/netlify.ts
git commit -m "feat(server): add Netlify REST API client"
```

---

## Task 2: Deploy Service

**Files:**
- Create: `packages/server/src/services/deploy.service.ts`

- [ ] **Step 1: Create deploy.service.ts**

```typescript
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
import { createSite, createDeploy, uploadFile, getDeployStatus } from '../lib/netlify'
import type { FileMap } from '@buildn/shared'

export async function startDeploy(projectId: string) {
  // Check for active deploys
  const active = await db.query.deploys.findFirst({
    where: and(
      eq(deploys.projectId, projectId),
      inArray(deploys.phase, ['queued', 'building', 'uploading']),
    ),
  })

  if (active) {
    return { error: 'A deployment is already in progress' }
  }

  const [deploy] = await db
    .insert(deploys)
    .values({ projectId, phase: 'queued' })
    .returning()

  // Run deploy in background (non-blocking)
  runDeploy(deploy.id, projectId).catch(console.error)

  return { deploy }
}

async function runDeploy(deployId: string, projectId: string) {
  const dir = join(tmpdir(), `buildn-deploy-${randomUUID()}`)

  try {
    // Phase: building
    await updatePhase(deployId, 'building')

    const files = await getProjectFiles(projectId)
    mkdirSync(dir, { recursive: true })

    // Write all project files
    for (const [path, content] of Object.entries(files)) {
      const fullPath = join(dir, path)
      mkdirSync(join(fullPath, '..'), { recursive: true })
      writeFileSync(fullPath, content)
    }

    // Install & build
    execSync('npm install --ignore-scripts 2>/dev/null', { cwd: dir, stdio: 'pipe', timeout: 60000 })
    execSync('npx vite build', { cwd: dir, stdio: 'pipe', timeout: 60000 })

    const distDir = join(dir, 'dist')

    // Phase: uploading
    await updatePhase(deployId, 'uploading')

    // Get or create Netlify site
    const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) })
    let siteId = project?.netlifySiteId

    if (!siteId) {
      const site = await createSite(project?.name ?? 'buildn-app')
      siteId = site.id
      await db.update(projects).set({ netlifySiteId: siteId }).where(eq(projects.id, projectId))
    }

    // Calculate file digests
    const distFiles = collectFiles(distDir, '')
    const digests: Record<string, string> = {}
    for (const [path, fullPath] of Object.entries(distFiles)) {
      const content = readFileSync(fullPath)
      digests[`/${path}`] = createHash('sha1').update(content).digest('hex')
    }

    // Create deploy and upload required files
    const netlifyDeploy = await createDeploy(siteId, digests)
    await db.update(deploys).set({ netlifyDeployId: netlifyDeploy.id }).where(eq(deploys.id, deployId))

    for (const requiredPath of netlifyDeploy.required) {
      const localPath = distFiles[requiredPath.slice(1)] // Remove leading /
      if (localPath) {
        await uploadFile(netlifyDeploy.id, requiredPath, readFileSync(localPath))
      }
    }

    // Wait for deploy to be ready
    let status = await getDeployStatus(netlifyDeploy.id)
    let attempts = 0
    while (status.state !== 'ready' && status.state !== 'error' && attempts < 30) {
      await new Promise((r) => setTimeout(r, 2000))
      status = await getDeployStatus(netlifyDeploy.id)
      attempts++
    }

    if (status.state === 'ready') {
      await db.update(deploys).set({ phase: 'ready', url: status.url, completedAt: new Date() }).where(eq(deploys.id, deployId))
      await db.update(projects).set({ deployUrl: status.url, status: 'published' }).where(eq(projects.id, projectId))
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
  await db.update(deploys).set({
    phase,
    ...(error ? { error } : {}),
    ...(phase === 'ready' || phase === 'failed' ? { completedAt: new Date() } : {}),
  }).where(eq(deploys.id, deployId))
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/services/deploy.service.ts
git commit -m "feat(server): add deploy service with Netlify build and upload pipeline"
```

---

## Task 3: Deploy Routes

**Files:**
- Create: `packages/server/src/routes/deploy.ts`
- Modify: `packages/server/src/app.ts`

- [ ] **Step 1: Create deploy.ts**

```typescript
import { Hono } from 'hono'
import { authMiddleware, type AuthUser } from '../middleware/auth'
import { getProject } from '../services/project.service'
import { startDeploy, getDeployStatusForProject } from '../services/deploy.service'

const deployRoutes = new Hono()

deployRoutes.use('*', authMiddleware)

// POST /api/projects/:id/deploy
deployRoutes.post('/:id/deploy', async (c) => {
  const user = c.get('user') as AuthUser
  const project = await getProject(c.req.param('id'), user.id)
  if (!project) return c.json({ error: 'Project not found' }, 404)

  const result = await startDeploy(project.id)
  if ('error' in result) return c.json({ error: result.error }, 409)

  return c.json({ deployId: result.deploy.id, status: 'queued' })
})

// GET /api/projects/:id/deploy/status
deployRoutes.get('/:id/deploy/status', async (c) => {
  const user = c.get('user') as AuthUser
  const project = await getProject(c.req.param('id'), user.id)
  if (!project) return c.json({ error: 'Project not found' }, 404)

  const status = await getDeployStatusForProject(project.id)
  if (!status) return c.json({ error: 'No deployments found' }, 404)

  return c.json(status)
})

export { deployRoutes }
```

- [ ] **Step 2: Register in app.ts**

Add: `app.route('/api/projects', deployRoutes)`

- [ ] **Step 3: Typecheck and commit**

```bash
git add packages/server/
git commit -m "feat(server): add deploy API routes"
```

---

## Task 4: Full Verification

- [ ] **Step 1: Typecheck** — `cd packages/server && pnpm typecheck`
- [ ] **Step 2: Build** — `pnpm build`
- [ ] **Step 3: Lint** — `pnpm lint`
