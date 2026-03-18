# Plan 2: Backend API — Server, Database, Auth & CRUD

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend API server with database schema, authentication, project/file CRUD, chat (SSE), and snapshot management.

**Architecture:** Hono web framework on Node.js, Drizzle ORM with PostgreSQL, Supabase Auth for user management, Redis for rate limiting and caching. All routes authenticated via JWT middleware except auth endpoints.

**Tech Stack:** Hono 4, Drizzle ORM, PostgreSQL (Supabase), Redis (ioredis), JWT (jose), bcrypt, Vitest

---

## File Structure

```
packages/server/
├── src/
│   ├── index.ts                    # App entry point (already exists, will be modified)
│   ├── app.ts                      # Hono app setup with middleware
│   ├── db/
│   │   ├── schema.ts               # Drizzle table definitions
│   │   ├── index.ts                # DB connection + drizzle instance
│   │   └── migrate.ts              # Migration runner
│   ├── middleware/
│   │   ├── auth.ts                 # JWT verification, ctx.user injection
│   │   └── rate-limit.ts           # Redis token-bucket rate limiter
│   ├── routes/
│   │   ├── auth.ts                 # POST /api/auth/register, login, github, GET /me
│   │   ├── projects.ts             # GET/POST/PATCH/DELETE /api/projects
│   │   ├── files.ts                # GET/PUT/DELETE /api/projects/:id/files
│   │   ├── chat.ts                 # POST /api/projects/:id/chat (SSE)
│   │   ├── messages.ts             # GET /api/projects/:id/messages
│   │   └── snapshots.ts            # GET /api/projects/:id/snapshots, POST restore
│   ├── services/
│   │   ├── auth.service.ts         # Password hashing, JWT sign/verify
│   │   ├── project.service.ts      # Project CRUD + ownership check
│   │   ├── file.service.ts         # File CRUD + path validation
│   │   ├── chat.service.ts         # AI engine orchestration + SSE
│   │   └── snapshot.service.ts     # Snapshot create/restore
│   └── lib/
│       ├── redis.ts                # Redis connection
│       └── env.ts                  # Environment variable validation
├── drizzle.config.ts               # Drizzle Kit config
├── package.json                    # (modify: add dependencies)
└── tsconfig.json                   # (already exists)
```

---

## Task 1: Environment & Database Setup

**Files:**

- Create: `packages/server/src/lib/env.ts`
- Create: `packages/server/src/db/schema.ts`
- Create: `packages/server/src/db/index.ts`
- Create: `packages/server/drizzle.config.ts`
- Modify: `packages/server/package.json`

- [ ] **Step 1: Add dependencies to package.json**

Add to `dependencies`:

```json
"drizzle-orm": "^0.44",
"postgres": "^3.4",
"jose": "^6",
"bcrypt": "^6"
```

Add to `devDependencies`:

```json
"drizzle-kit": "^0.31",
"@types/bcrypt": "^5",
"vitest": "^3"
```

Add script:

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:studio": "drizzle-kit studio",
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: Create packages/server/src/lib/env.ts**

```typescript
function required(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing required env var: ${key}`)
  return value
}

export const env = {
  get DATABASE_URL() {
    return required('DATABASE_URL')
  },
  get JWT_SECRET() {
    return required('JWT_SECRET')
  },
  get REDIS_URL() {
    return process.env.REDIS_URL ?? 'redis://localhost:6379'
  },
  get PORT() {
    return Number(process.env.PORT) || 3001
  },
} as const
```

- [ ] **Step 3: Create packages/server/src/db/schema.ts**

```typescript
import { pgTable, uuid, varchar, text, timestamp, jsonb, unique } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }),
  githubId: varchar('github_id', { length: 50 }).unique(),
  plan: varchar('plan', { length: 20 }).notNull().default('free'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description').default(''),
  template: varchar('template', { length: 50 }).notNull().default('blank'),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  deployUrl: varchar('deploy_url', { length: 500 }),
  netlifySiteId: varchar('netlify_site_id', { length: 100 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const files = pgTable(
  'files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    path: varchar('path', { length: 500 }).notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [unique('files_project_path').on(t.projectId, t.path)],
)

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull(),
  content: text('content').notNull(),
  fileOperations: jsonb('file_operations'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const snapshots = pgTable('snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  messageId: uuid('message_id').references(() => messages.id),
  description: varchar('description', { length: 500 }).notNull(),
  files: jsonb('files').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const deploys = pgTable('deploys', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  phase: varchar('phase', { length: 20 }).notNull(),
  netlifyDeployId: varchar('netlify_deploy_id', { length: 100 }),
  url: varchar('url', { length: 500 }),
  error: text('error'),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
})
```

- [ ] **Step 4: Create packages/server/src/db/index.ts**

```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import { env } from '../lib/env'

const client = postgres(env.DATABASE_URL)
export const db = drizzle(client, { schema })
```

- [ ] **Step 5: Create packages/server/drizzle.config.ts**

```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

- [ ] **Step 6: Install and typecheck**

Run: `pnpm install && cd packages/server && pnpm typecheck`

- [ ] **Step 7: Commit**

```bash
git add packages/server/
git commit -m "feat(server): add database schema with Drizzle ORM and env config"
```

---

## Task 2: Auth Service & JWT Middleware

**Files:**

- Create: `packages/server/src/services/auth.service.ts`
- Create: `packages/server/src/middleware/auth.ts`
- Create: `packages/server/src/routes/auth.ts`
- Create: `packages/server/src/app.ts`
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: Create packages/server/src/services/auth.service.ts**

```typescript
import { eq } from 'drizzle-orm'
import bcrypt from 'bcrypt'
import { SignJWT, jwtVerify } from 'jose'
import { db } from '../db'
import { users } from '../db/schema'
import { env } from '../lib/env'

const secret = () => new TextEncoder().encode(env.JWT_SECRET)

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function signToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret())
}

export async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    return payload.sub ?? null
  } catch {
    return null
  }
}

export async function findUserByEmail(email: string) {
  return db.query.users.findFirst({ where: eq(users.email, email) })
}

export async function findUserById(id: string) {
  return db.query.users.findFirst({ where: eq(users.id, id) })
}

export async function createUser(email: string, name: string, passwordHash: string) {
  const [user] = await db.insert(users).values({ email, name, passwordHash }).returning()
  return user
}
```

- [ ] **Step 2: Create packages/server/src/middleware/auth.ts**

```typescript
import type { Context, Next } from 'hono'
import { verifyToken, findUserById } from '../services/auth.service'

export type AuthUser = {
  id: string
  email: string
  name: string
  plan: string
}

export async function authMiddleware(c: Context, next: Next) {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401)
  }

  const token = header.slice(7)
  const userId = await verifyToken(token)
  if (!userId) {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }

  const user = await findUserById(userId)
  if (!user) {
    return c.json({ error: 'User not found' }, 401)
  }

  c.set('user', { id: user.id, email: user.email, name: user.name, plan: user.plan })
  await next()
}
```

- [ ] **Step 3: Create packages/server/src/routes/auth.ts**

```typescript
import { Hono } from 'hono'
import {
  hashPassword,
  verifyPassword,
  signToken,
  findUserByEmail,
  createUser,
  findUserById,
} from '../services/auth.service'
import { authMiddleware, type AuthUser } from '../middleware/auth'

const auth = new Hono()

// POST /api/auth/register
auth.post('/register', async (c) => {
  const { email, password, name } = await c.req.json<{
    email: string
    password: string
    name: string
  }>()

  if (!email || !password || !name) {
    return c.json({ error: 'email, password, and name are required' }, 400)
  }

  const existing = await findUserByEmail(email)
  if (existing) {
    return c.json({ error: 'Email already registered' }, 409)
  }

  const passwordHash = await hashPassword(password)
  const user = await createUser(email, name, passwordHash)
  const token = await signToken(user.id)

  return c.json(
    {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        createdAt: user.createdAt,
      },
      token,
    },
    201,
  )
})

// POST /api/auth/login
auth.post('/login', async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>()

  const user = await findUserByEmail(email)
  if (!user || !user.passwordHash) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  const token = await signToken(user.id)
  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      createdAt: user.createdAt,
    },
    token,
  })
})

// GET /api/auth/me
auth.get('/me', authMiddleware, async (c) => {
  const authUser = c.get('user') as AuthUser
  const user = await findUserById(authUser.id)
  if (!user) return c.json({ error: 'User not found' }, 404)

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      createdAt: user.createdAt,
    },
  })
})

export { auth }
```

- [ ] **Step 4: Create packages/server/src/app.ts**

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { auth } from './routes/auth'

const app = new Hono()

app.use('/api/*', cors())

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.route('/api/auth', auth)

export { app }
```

- [ ] **Step 5: Update packages/server/src/index.ts**

```typescript
import { serve } from '@hono/node-server'
import { app } from './app'
import { env } from './lib/env'

serve({ fetch: app.fetch, port: env.PORT }, () => {
  console.log(`Buildn API server running on http://localhost:${env.PORT}`)
})
```

- [ ] **Step 6: Install, typecheck, commit**

Run: `pnpm install && cd packages/server && pnpm typecheck`

```bash
git add packages/server/
git commit -m "feat(server): add auth service with JWT, register, login, me endpoints"
```

---

## Task 3: Project CRUD API

**Files:**

- Create: `packages/server/src/services/project.service.ts`
- Create: `packages/server/src/routes/projects.ts`
- Modify: `packages/server/src/app.ts`

- [ ] **Step 1: Create packages/server/src/services/project.service.ts**

```typescript
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
```

- [ ] **Step 2: Create packages/server/src/routes/projects.ts**

```typescript
import { Hono } from 'hono'
import { authMiddleware, type AuthUser } from '../middleware/auth'
import {
  listProjects,
  getProject,
  getProjectFiles,
  createProject,
  updateProject,
  deleteProject,
} from '../services/project.service'

const projectRoutes = new Hono()

projectRoutes.use('*', authMiddleware)

// GET /api/projects
projectRoutes.get('/', async (c) => {
  const user = c.get('user') as AuthUser
  const list = await listProjects(user.id)
  return c.json({ projects: list })
})

// POST /api/projects
projectRoutes.post('/', async (c) => {
  const user = c.get('user') as AuthUser
  const body = await c.req.json<{ name: string; description?: string; template?: string }>()

  if (!body.name) return c.json({ error: 'name is required' }, 400)

  const result = await createProject(user.id, user.plan, body)
  if ('error' in result) return c.json({ error: result.error }, 403)

  return c.json({ project: result.project }, 201)
})

// GET /api/projects/:id
projectRoutes.get('/:id', async (c) => {
  const user = c.get('user') as AuthUser
  const project = await getProject(c.req.param('id'), user.id)
  if (!project) return c.json({ error: 'Project not found' }, 404)

  const files = await getProjectFiles(project.id)
  return c.json({ project, files })
})

// PATCH /api/projects/:id
projectRoutes.patch('/:id', async (c) => {
  const user = c.get('user') as AuthUser
  const body = await c.req.json<{ name?: string; description?: string }>()
  const project = await updateProject(c.req.param('id'), user.id, body)
  if (!project) return c.json({ error: 'Project not found' }, 404)

  return c.json({ project })
})

// DELETE /api/projects/:id
projectRoutes.delete('/:id', async (c) => {
  const user = c.get('user') as AuthUser
  const deleted = await deleteProject(c.req.param('id'), user.id)
  if (!deleted) return c.json({ error: 'Project not found' }, 404)

  return c.body(null, 204)
})

export { projectRoutes }
```

- [ ] **Step 3: Register route in app.ts**

Add to `packages/server/src/app.ts`:

```typescript
import { projectRoutes } from './routes/projects'
// after auth route
app.route('/api/projects', projectRoutes)
```

- [ ] **Step 4: Typecheck and commit**

Run: `cd packages/server && pnpm typecheck`

```bash
git add packages/server/
git commit -m "feat(server): add project CRUD API with ownership checks and plan limits"
```

---

## Task 4: File CRUD API

**Files:**

- Create: `packages/server/src/services/file.service.ts`
- Create: `packages/server/src/routes/files.ts`
- Modify: `packages/server/src/app.ts`

- [ ] **Step 1: Create packages/server/src/services/file.service.ts**

```typescript
import { eq, and } from 'drizzle-orm'
import { db } from '../db'
import { files } from '../db/schema'
import type { FileTreeNode } from '@buildn/shared'

function validatePath(path: string): boolean {
  if (!path || path.includes('..') || path.startsWith('/')) return false
  if (/[<>:"|?*\x00-\x1f]/.test(path)) return false
  return true
}

function buildTree(filePaths: string[]): FileTreeNode[] {
  const root: FileTreeNode[] = []

  for (const filePath of filePaths.sort()) {
    const parts = filePath.split('/')
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]
      const isFile = i === parts.length - 1
      const currentPath = parts.slice(0, i + 1).join('/')

      let node = current.find((n) => n.name === name)
      if (!node) {
        node = {
          name,
          path: currentPath,
          type: isFile ? 'file' : 'directory',
          ...(isFile ? {} : { children: [] }),
        }
        current.push(node)
      }

      if (!isFile) current = node.children!
    }
  }

  return root
}

export async function listFiles(projectId: string): Promise<FileTreeNode[]> {
  const rows = await db.query.files.findMany({
    where: eq(files.projectId, projectId),
    columns: { path: true },
  })
  return buildTree(rows.map((r) => r.path))
}

export async function readFile(projectId: string, path: string) {
  if (!validatePath(path)) return { error: 'Invalid file path' }

  const file = await db.query.files.findFirst({
    where: and(eq(files.projectId, projectId), eq(files.path, path)),
  })
  return file ? { path: file.path, content: file.content } : null
}

export async function writeFile(projectId: string, path: string, content: string) {
  if (!validatePath(path)) return { error: 'Invalid file path' }

  const [file] = await db
    .insert(files)
    .values({ projectId, path, content })
    .onConflictDoUpdate({
      target: [files.projectId, files.path],
      set: { content, updatedAt: new Date() },
    })
    .returning()

  return { file }
}

export async function deleteFile(projectId: string, path: string) {
  if (!validatePath(path)) return { error: 'Invalid file path' }

  const result = await db
    .delete(files)
    .where(and(eq(files.projectId, projectId), eq(files.path, path)))
    .returning({ id: files.id })

  return result.length > 0
}
```

- [ ] **Step 2: Create packages/server/src/routes/files.ts**

```typescript
import { Hono } from 'hono'
import { authMiddleware, type AuthUser } from '../middleware/auth'
import { getProject } from '../services/project.service'
import { listFiles, readFile, writeFile, deleteFile } from '../services/file.service'

const fileRoutes = new Hono()

fileRoutes.use('*', authMiddleware)

// GET /api/projects/:id/files
fileRoutes.get('/:id/files', async (c) => {
  const user = c.get('user') as AuthUser
  const project = await getProject(c.req.param('id'), user.id)
  if (!project) return c.json({ error: 'Project not found' }, 404)

  const tree = await listFiles(project.id)
  return c.json({ tree })
})

// GET /api/projects/:id/files/*path
fileRoutes.get('/:id/files/*', async (c) => {
  const user = c.get('user') as AuthUser
  const project = await getProject(c.req.param('id'), user.id)
  if (!project) return c.json({ error: 'Project not found' }, 404)

  const filePath = c.req.path.split('/files/').slice(1).join('/files/')
  const result = await readFile(project.id, filePath)
  if (!result) return c.json({ error: 'File not found' }, 404)
  if ('error' in result) return c.json({ error: result.error }, 400)

  return c.json(result)
})

// PUT /api/projects/:id/files/*path
fileRoutes.put('/:id/files/*', async (c) => {
  const user = c.get('user') as AuthUser
  const project = await getProject(c.req.param('id'), user.id)
  if (!project) return c.json({ error: 'Project not found' }, 404)

  const filePath = c.req.path.split('/files/').slice(1).join('/files/')
  const { content } = await c.req.json<{ content: string }>()
  if (content === undefined) return c.json({ error: 'content is required' }, 400)

  const result = await writeFile(project.id, filePath, content)
  if ('error' in result) return c.json({ error: result.error }, 400)

  return c.json(result)
})

// DELETE /api/projects/:id/files/*path
fileRoutes.delete('/:id/files/*', async (c) => {
  const user = c.get('user') as AuthUser
  const project = await getProject(c.req.param('id'), user.id)
  if (!project) return c.json({ error: 'Project not found' }, 404)

  const filePath = c.req.path.split('/files/').slice(1).join('/files/')
  const deleted = await deleteFile(project.id, filePath)
  if (!deleted) return c.json({ error: 'File not found' }, 404)

  return c.body(null, 204)
})

export { fileRoutes }
```

- [ ] **Step 3: Register routes in app.ts**

Add to `packages/server/src/app.ts`:

```typescript
import { fileRoutes } from './routes/files'
// Mount on /api/projects since file routes include /:id/files
app.route('/api/projects', fileRoutes)
```

- [ ] **Step 4: Typecheck and commit**

Run: `cd packages/server && pnpm typecheck`

```bash
git add packages/server/
git commit -m "feat(server): add file CRUD API with path validation and tree building"
```

---

## Task 5: Chat API (SSE Streaming)

**Files:**

- Create: `packages/server/src/services/chat.service.ts`
- Create: `packages/server/src/routes/chat.ts`
- Create: `packages/server/src/routes/messages.ts`
- Modify: `packages/server/src/app.ts`
- Modify: `packages/server/package.json` (add @buildn/ai-engine dependency)

- [ ] **Step 1: Add ai-engine dependency**

Add to `packages/server/package.json` dependencies:

```json
"@buildn/ai-engine": "workspace:*"
```

- [ ] **Step 2: Create packages/server/src/services/chat.service.ts**

```typescript
import { eq, desc } from 'drizzle-orm'
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
        await tx.delete(files).where(eq(files.projectId, projectId))
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
```

- [ ] **Step 3: Create packages/server/src/routes/chat.ts**

```typescript
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { authMiddleware, type AuthUser } from '../middleware/auth'
import { getProject } from '../services/project.service'
import { streamChat } from '../services/chat.service'

const chatRoutes = new Hono()

chatRoutes.use('*', authMiddleware)

// POST /api/projects/:id/chat
chatRoutes.post('/:id/chat', async (c) => {
  const user = c.get('user') as AuthUser
  const project = await getProject(c.req.param('id'), user.id)
  if (!project) return c.json({ error: 'Project not found' }, 404)

  const { prompt } = await c.req.json<{ prompt: string }>()
  if (!prompt) return c.json({ error: 'prompt is required' }, 400)

  return streamSSE(c, async (stream) => {
    try {
      for await (const event of streamChat(project.id, prompt)) {
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        })
      }
    } catch (err) {
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({
          type: 'error',
          error: { code: 'LLM_TIMEOUT', message: String(err), retryable: true },
        }),
      })
    }
  })
})

export { chatRoutes }
```

- [ ] **Step 4: Create packages/server/src/routes/messages.ts**

```typescript
import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import { authMiddleware, type AuthUser } from '../middleware/auth'
import { getProject } from '../services/project.service'
import { db } from '../db'
import { messages } from '../db/schema'

const messageRoutes = new Hono()

messageRoutes.use('*', authMiddleware)

// GET /api/projects/:id/messages
messageRoutes.get('/:id/messages', async (c) => {
  const user = c.get('user') as AuthUser
  const project = await getProject(c.req.param('id'), user.id)
  if (!project) return c.json({ error: 'Project not found' }, 404)

  const limit = Number(c.req.query('limit')) || 50
  const rows = await db.query.messages.findMany({
    where: eq(messages.projectId, project.id),
    orderBy: [desc(messages.createdAt)],
    limit,
  })

  return c.json({ messages: rows.reverse() })
})

export { messageRoutes }
```

- [ ] **Step 5: Register routes in app.ts**

Add to `packages/server/src/app.ts`:

```typescript
import { chatRoutes } from './routes/chat'
import { messageRoutes } from './routes/messages'

app.route('/api/projects', chatRoutes)
app.route('/api/projects', messageRoutes)
```

- [ ] **Step 6: Install, typecheck, commit**

Run: `pnpm install && cd packages/server && pnpm typecheck`

```bash
git add packages/server/
git commit -m "feat(server): add chat SSE streaming and message history API"
```

---

## Task 6: Snapshot API

**Files:**

- Create: `packages/server/src/services/snapshot.service.ts`
- Create: `packages/server/src/routes/snapshots.ts`
- Modify: `packages/server/src/app.ts`

- [ ] **Step 1: Create packages/server/src/services/snapshot.service.ts**

```typescript
import { eq, desc, and } from 'drizzle-orm'
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
```

- [ ] **Step 2: Create packages/server/src/routes/snapshots.ts**

```typescript
import { Hono } from 'hono'
import { authMiddleware, type AuthUser } from '../middleware/auth'
import { getProject } from '../services/project.service'
import { listSnapshots, restoreSnapshot } from '../services/snapshot.service'

const snapshotRoutes = new Hono()

snapshotRoutes.use('*', authMiddleware)

// GET /api/projects/:id/snapshots
snapshotRoutes.get('/:id/snapshots', async (c) => {
  const user = c.get('user') as AuthUser
  const project = await getProject(c.req.param('id'), user.id)
  if (!project) return c.json({ error: 'Project not found' }, 404)

  const list = await listSnapshots(project.id)
  return c.json({ snapshots: list })
})

// POST /api/projects/:id/snapshots/:sid/restore
snapshotRoutes.post('/:id/snapshots/:sid/restore', async (c) => {
  const user = c.get('user') as AuthUser
  const project = await getProject(c.req.param('id'), user.id)
  if (!project) return c.json({ error: 'Project not found' }, 404)

  const files = await restoreSnapshot(project.id, c.req.param('sid'))
  if (!files) return c.json({ error: 'Snapshot not found' }, 404)

  return c.json({ files })
})

export { snapshotRoutes }
```

- [ ] **Step 3: Register routes in app.ts**

Add to `packages/server/src/app.ts`:

```typescript
import { snapshotRoutes } from './routes/snapshots'
app.route('/api/projects', snapshotRoutes)
```

- [ ] **Step 4: Typecheck and commit**

Run: `cd packages/server && pnpm typecheck`

```bash
git add packages/server/
git commit -m "feat(server): add snapshot list and restore API"
```

---

## Task 7: Rate Limiting Middleware

**Files:**

- Create: `packages/server/src/lib/redis.ts`
- Create: `packages/server/src/middleware/rate-limit.ts`
- Modify: `packages/server/package.json` (add ioredis)
- Modify: `packages/server/src/app.ts`

- [ ] **Step 1: Add ioredis dependency**

Add to `packages/server/package.json` dependencies:

```json
"ioredis": "^5"
```

- [ ] **Step 2: Create packages/server/src/lib/redis.ts**

```typescript
import Redis from 'ioredis'
import { env } from './env'

let redis: Redis | null = null

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 })
  }
  return redis
}
```

- [ ] **Step 3: Create packages/server/src/middleware/rate-limit.ts**

```typescript
import type { Context, Next } from 'hono'
import { getRedis } from '../lib/redis'
import type { AuthUser } from './auth'

const LIMITS: Record<string, number> = {
  free: 20,
  pro: 100,
  team: 500,
}

export async function rateLimitMiddleware(c: Context, next: Next) {
  const user = c.get('user') as AuthUser | undefined
  if (!user) return next()

  const limit = LIMITS[user.plan] ?? 20
  const key = `rate:${user.id}:${Math.floor(Date.now() / 60000)}`

  try {
    const redis = getRedis()
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, 60)

    c.header('X-RateLimit-Limit', String(limit))
    c.header('X-RateLimit-Remaining', String(Math.max(0, limit - count)))

    if (count > limit) {
      return c.json({ error: 'Rate limit exceeded' }, 429)
    }
  } catch {
    // If Redis is down, allow the request through
  }

  return next()
}
```

- [ ] **Step 4: Apply middleware in app.ts**

Add to `packages/server/src/app.ts` after cors:

```typescript
import { rateLimitMiddleware } from './middleware/rate-limit'
app.use('/api/*', rateLimitMiddleware)
```

- [ ] **Step 5: Install, typecheck, commit**

Run: `pnpm install && cd packages/server && pnpm typecheck`

```bash
git add packages/server/
git commit -m "feat(server): add Redis-based rate limiting middleware"
```

---

## Task 8: Full Server Typecheck & Build Verification

- [ ] **Step 1: Verify all server files compile**

Run: `cd packages/server && pnpm typecheck`
Expected: No errors

- [ ] **Step 2: Verify full monorepo build**

Run: `pnpm build`
Expected: All packages build successfully

- [ ] **Step 3: Verify lint**

Run: `pnpm lint`
Expected: No errors (warnings OK)

- [ ] **Step 4: Final commit if needed**

```bash
git diff --quiet || (git add -A && git commit -m "chore(server): fix any remaining issues")
```
