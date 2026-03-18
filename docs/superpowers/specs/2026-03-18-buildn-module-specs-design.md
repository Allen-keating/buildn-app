# Buildn Module Specifications

> Derived from `docs/DEVELOPMENT.md`. Each module is described with its interfaces, data flows, dependencies, edge cases, and acceptance criteria.

## Table of Contents

1. [AI Code Generation Engine](#module-1-ai-code-generation-engine)
2. [WebContainer Sandbox](#module-2-webcontainer-sandbox)
3. [Chat UI](#module-3-chat-ui)
4. [Project Management Service](#module-4-project-management-service)
5. [Deploy Service](#module-5-deploy-service)

---

## Module 1: AI Code Generation Engine

**Package:** `packages/ai-engine/`

### 1.1 Responsibility

Receives a natural language request plus project context, calls an LLM to generate or modify code, validates the output through a post-processing pipeline, and returns a list of file operations.

### 1.2 Public Interface

```typescript
// Main entry point — the only exported function
function generateCode(request: GenerateRequest): AsyncGenerator<GenerateEvent>

// Input
interface GenerateRequest {
  prompt: string
  projectFiles: FileMap
  conversationHistory: ConversationMessage[]
  config?: GenerateConfig
}

interface GenerateConfig {
  model?: string // LLM model ID, default claude-sonnet-4-6
  maxRetries?: number // Post-processing retry count, default 3
  tokenBudget?: number // Context token limit, default 120_000
  skipPostProcess?: boolean // Skip post-processing (debug only)
}

// Output — streamed events
type GenerateEvent =
  | { type: 'intent'; intent: Intent }
  | { type: 'token'; text: string }
  | { type: 'file_operation'; operation: FileOperation }
  | { type: 'validation'; result: ValidationResult }
  | { type: 'retry'; attempt: number; errors: string[] }
  | { type: 'done'; operations: FileOperation[] }
  | { type: 'error'; error: EngineError }
```

### 1.3 Internal Data Flow

```
GenerateRequest
    |
    v
[Classifier] --> Intent (create | modify | question | deploy)
    |
    |  If intent === 'question' -> call LLM directly, no code generation
    v
[ContextAssembler]
    +- Select relevant files by intent (create: templates; modify: related files)
    +- Trim by tokenBudget (priority: mentioned files > entry files > dependencies)
    +- Assemble: systemPrompt + projectContext + conversationHistory + userPrompt
    |
    v
[LLMClient]
    +- Call Anthropic SDK in streaming mode
    +- Yield each token via AsyncGenerator
    +- Pass complete response to Parser
    |
    v
[OutputParser]
    +- Regex match ---FILE: path--- ... ---END FILE--- blocks
    +- Compare with existing files to determine create / modify / delete
    +- Output FileOperation[]
    |
    v
[PostProcessor] (skipped when skipPostProcess is true)
    +- TypeCheck: run tsc --noEmit in memory
    +- Lint: ESLint check (auto-fix where possible)
    +- BuildTest: vite build verification
    +- Any failure -> collect errors, build fix prompt, retry via LLMClient
    +- All pass -> yield done event
```

### 1.4 Dependencies

| Dependency          | Purpose                                                          |
| ------------------- | ---------------------------------------------------------------- |
| `@anthropic-ai/sdk` | LLM API calls                                                    |
| `packages/shared`   | Shared types (`FileMap`, `FileOperation`, `ConversationMessage`) |
| `typescript`        | Type checking (programmatic API)                                 |
| `eslint`            | Code quality checks                                              |
| `vite`              | Build verification                                               |

**Depended on by:** `packages/server` (ChatService calls `generateCode`)

### 1.5 Core Type Definitions

```typescript
type Intent = 'create' | 'modify' | 'question' | 'deploy'

type FileMap = Record<string, string> // { "src/App.tsx": "import..." }

interface FileOperation {
  type: 'create' | 'modify' | 'delete'
  path: string
  content?: string // undefined for delete
  diff?: string // unified diff for modify (used by UI)
}

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ValidationResult {
  step: 'typecheck' | 'lint' | 'build'
  passed: boolean
  errors?: string[]
}

interface EngineError {
  code:
    | 'LLM_TIMEOUT'
    | 'LLM_RATE_LIMIT'
    | 'PARSE_FAILED'
    | 'MAX_RETRIES_EXCEEDED'
    | 'TOKEN_BUDGET_EXCEEDED'
  message: string
  retryable: boolean
}
```

### 1.6 Edge Cases and Error Handling

| Scenario                                           | Handling                                                                               |
| -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| LLM output does not follow `---FILE:---` format    | Parser attempts loose matching (code block fallback); yields `PARSE_FAILED` on failure |
| Context exceeds tokenBudget                        | ContextAssembler trims files by priority; yields `TOKEN_BUDGET_EXCEEDED` if still over |
| Post-processing fails after 3 retries              | Yields `MAX_RETRIES_EXCEEDED`; returns last FileOperation[] marked as unvalidated      |
| LLM API timeout or rate limit                      | Exponential backoff, retry twice; yields corresponding error on failure                |
| Empty or meaningless user prompt                   | Classifier returns `question` intent; LLM responds with guidance                       |
| Generated code references non-existent npm package | Caught at BuildTest stage; error fed back to LLM for retry                             |

### 1.7 Acceptance Criteria

- [ ] Input "create a counter app" produces runnable React component files
- [ ] Modification request + existing files only changes relevant files
- [ ] Streaming token events with < 500ms time-to-first-token
- [ ] Post-processing detects type errors and auto-retries to fix them
- [ ] After 3 failed retries, returns error event without infinite looping
- [ ] Context trimming keeps token count within budget

---

## Module 2: WebContainer Sandbox

**Package:** `packages/web/` (sandbox module)

### 2.1 Responsibility

Manages a WebContainer instance in the browser, providing virtual file system operations, npm dependency installation, Vite dev server lifecycle, and real-time preview management.

### 2.2 Public Interface

```typescript
interface Sandbox {
  // Lifecycle
  boot(initialFiles: FileMap): Promise<void>
  teardown(): Promise<void>

  // File operations
  writeFile(path: string, content: string): Promise<void>
  writeFiles(files: FileMap): Promise<void>
  readFile(path: string): Promise<string>
  deleteFile(path: string): Promise<void>
  listFiles(dir?: string): Promise<FileTreeNode[]>

  // Dev server
  startDevServer(): Promise<{ url: string }>
  stopDevServer(): Promise<void>
  restartDevServer(): Promise<{ url: string }>

  // Package management
  installPackages(packages?: string[]): Promise<InstallResult>

  // Build
  build(): Promise<BuildResult>

  // State and events
  getStatus(): SandboxStatus
  onStatusChange(listener: (status: SandboxStatus) => void): () => void
  onServerReady(listener: (url: string) => void): () => void
  onError(listener: (error: SandboxError) => void): () => void
}

function createSandbox(): Sandbox
```

### 2.3 Internal Data Flow

```
createSandbox()
    |
    v
boot(initialFiles)
    +- WebContainer.boot()
    +- wc.mount(initialFiles)   <- convert FileMap to WebContainer FileSystemTree
    +- Status: 'booting' -> 'ready'
    |
    v
installPackages()
    +- wc.spawn('npm', ['install'])
    +- Monitor stdout/stderr -> progress events
    +- Status: 'installing'
    +- On completion -> 'ready'
    |
    v
startDevServer()
    +- wc.spawn('npm', ['run', 'dev'])
    +- Monitor stdout for port number
    +- wc.on('server-ready') -> capture preview URL
    +- Status: 'running'
    +- Return { url } for PreviewPanel to set iframe.src
    |
    v
writeFiles(files)  <- called after AI generates code
    +- wc.fs.writeFile() for each file
    +- Detect package.json change -> auto installPackages()
    +- Vite HMR auto-detects file changes -> iframe hot update
```

### 2.4 Dependencies

| Dependency          | Purpose                                  |
| ------------------- | ---------------------------------------- |
| `@webcontainer/api` | In-browser Node.js runtime               |
| `packages/shared`   | Shared types (`FileMap`, `FileTreeNode`) |

**Depended on by:**

- `PreviewPanel` — calls `onServerReady` for preview URL
- `FileTree` — calls `listFiles` for directory tree
- `CodeEditor` — calls `readFile`/`writeFile` for manual edits
- Chat flow — calls `writeFiles` after AI code generation

### 2.5 Core Type Definitions

```typescript
type SandboxStatus = 'idle' | 'booting' | 'installing' | 'running' | 'building' | 'error'

interface FileTreeNode {
  name: string
  path: string // relative path "src/components/Button.tsx"
  type: 'file' | 'directory'
  children?: FileTreeNode[] // present when type === 'directory'
}

interface InstallResult {
  success: boolean
  duration: number // ms
  installedPackages?: string[]
  errors?: string[]
}

interface BuildResult {
  success: boolean
  outputFiles: string[] // files under dist/
  errors?: string[]
  warnings?: string[]
}

interface SandboxError {
  code: 'BOOT_FAILED' | 'INSTALL_FAILED' | 'SERVER_CRASH' | 'BUILD_FAILED' | 'FS_ERROR'
  message: string
  details?: string // full stderr output
}
```

### 2.6 Edge Cases and Error Handling

| Scenario                                        | Handling                                                                                                          |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| WebContainer.boot() fails (unsupported browser) | Yield `BOOT_FAILED`; UI shows degradation notice (recommend Chrome)                                               |
| npm install timeout (large dependencies)        | 30s timeout, kill process, return `INSTALL_FAILED`; UI prompts retry                                              |
| Vite dev server crashes                         | Listen for process exit; auto `restartDevServer()` (max 2 attempts)                                               |
| package.json modified by AI (new dependencies)  | `writeFiles` detects package.json change; auto `installPackages()` before HMR                                     |
| User manual edit conflicts with AI generation   | `writeFiles` overwrites (AI takes priority); snapshot created before overwrite; status bar shows "snapshot saved" |
| File path contains illegal characters           | `writeFile` validates path format; rejects with `FS_ERROR`                                                        |
| WebContainer out of memory (large project)      | Listen for unhandledrejection; prompt user to reduce files or refresh                                             |

### 2.7 Acceptance Criteria

- [ ] `boot()` completes WebContainer startup and file mounting within 5s
- [ ] `writeFiles()` triggers Vite HMR auto-refresh without manual action
- [ ] `listFiles()` returns complete file tree matching actual files
- [ ] `installPackages()` installs common npm packages (react, tailwindcss, etc.)
- [ ] `build()` produces output consistent with `vite build`
- [ ] Unsupported browser gets a clear error message
- [ ] Vite crash triggers auto-restart, transparent to user

---

## Module 3: Chat UI

**Package:** `packages/web/`

### 3.1 Responsibility

Provides a three-column layout user interface with chat interaction, code browsing/editing, and real-time preview. This is the sole entry point for user interaction with the system.

### 3.2 Public Interface (Component Props)

```typescript
// ==================== Layout ====================

interface AppShellProps {
  project: Project
}

interface HeaderProps {
  projectName: string
  onPublish: () => void
  onSettings: () => void
}

interface StatusBarProps {
  sandboxStatus: SandboxStatus
  fileCount: number
  buildStatus: 'idle' | 'passing' | 'failing'
}

// ==================== Chat Panel ====================

interface ChatPanelProps {
  projectId: string
  messages: ChatMessage[]
  onSendMessage: (prompt: string) => void
  isGenerating: boolean
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  fileOperations?: FileOperation[]
  status: 'pending' | 'streaming' | 'done' | 'error'
  createdAt: Date
}

interface MessageBubbleProps {
  message: ChatMessage
  onFileClick: (path: string) => void
}

interface ChatInputProps {
  onSubmit: (text: string) => void
  disabled: boolean
  placeholder?: string
}

// ==================== Code Editor ====================

interface CodeEditorProps {
  file: { path: string; content: string } | null
  onChange: (path: string, content: string) => void
  readOnly?: boolean
}

interface FileTreeProps {
  tree: FileTreeNode[]
  selectedPath: string | null
  onSelect: (path: string) => void
  changedPaths?: string[]
}

interface FileTabsProps {
  openFiles: string[]
  activePath: string | null
  onSelect: (path: string) => void
  onClose: (path: string) => void
}

// ==================== Preview Panel ====================

interface PreviewPanelProps {
  url: string | null
  isLoading: boolean
  device: DeviceType
  onDeviceChange: (device: DeviceType) => void
}

type DeviceType = 'desktop' | 'tablet' | 'phone'

interface ErrorOverlayProps {
  error: SandboxError | null
  onDismiss: () => void
  onRetry: () => void
}
```

### 3.3 State Management (Zustand Store)

```typescript
interface AppStore {
  // Project
  project: Project | null
  files: FileMap

  // Chat
  messages: ChatMessage[]
  isGenerating: boolean
  sendMessage: (prompt: string) => Promise<void>

  // Editor
  openFiles: string[]
  activeFilePath: string | null
  openFile: (path: string) => void
  closeFile: (path: string) => void

  // Sandbox
  sandboxStatus: SandboxStatus
  previewUrl: string | null

  // Deploy
  isDeploying: boolean
  deployUrl: string | null
  publish: () => Promise<void>
}
```

**`sendMessage` core flow:**

```
User types prompt -> onSendMessage()
    |
    +- [1] Append user message to messages[], set isGenerating = true
    |
    +- [2] Call POST /api/projects/:id/chat (SSE)
    |       +- token event -> append to assistant message.content (streaming render)
    |       +- file_operation event -> append to message.fileOperations
    |       +- done event -> proceed to step 3
    |
    +- [3] Sync FileOperation[] to Sandbox
    |       +- sandbox.writeFiles(operations)
    |       +- If package.json changed -> auto installPackages
    |       +- Vite HMR -> preview auto-updates
    |
    +- [4] Update files state, highlight changed files
    |
    +- [5] Set isGenerating = false
```

### 3.4 Page Routes

```typescript
'/'                  -> Project list page (simple card grid)
'/project/:id'       -> Main workspace (three-column layout)
'/login'             -> Login page
```

### 3.5 Dependencies

| Dependency                      | Purpose                        |
| ------------------------------- | ------------------------------ |
| `react` / `react-dom`           | UI framework                   |
| `zustand`                       | State management               |
| `@monaco-editor/react`          | Code editor                    |
| `react-markdown` + `remark-gfm` | Markdown rendering in messages |
| `shiki`                         | Code syntax highlighting       |
| `react-diff-viewer`             | Diff display                   |
| `shadcn/ui`                     | Base UI components             |
| Sandbox (Module 2)              | File operations and preview    |
| `packages/shared`               | Shared types                   |

**Depended on by:** None (top-level application)

### 3.6 Edge Cases and Error Handling

| Scenario                                       | Handling                                                                                            |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| SSE connection interrupted during AI streaming | Detect SSE close; mark message as `error`; show retry button                                        |
| User sends message while AI is generating      | Input disabled; block duplicate requests                                                            |
| File tree has > 100 files                      | Virtual scrolling + expand directories on demand                                                    |
| Monaco Editor loads large file (> 10k lines)   | Show warning; lazy load; disable some highlighting features                                         |
| Preview iframe fails to load                   | ErrorOverlay with error details + retry button                                                      |
| User manual edit conflicts with AI generation  | AI generation overwrites; auto-snapshot created before overwrite; status bar shows "snapshot saved" |
| Browser window too narrow (< 768px)            | Three columns switch to tab mode (Chat / Code / Preview toggle)                                     |
| XSS in Markdown messages                       | `react-markdown` does not execute HTML by default; additionally use `rehype-sanitize`               |

### 3.7 Acceptance Criteria

- [ ] Three-column layout with draggable width adjustment; each panel scrolls independently
- [ ] AI responses stream character by character after user sends a message
- [ ] Code blocks in AI responses have syntax highlighting; file changes show diff view
- [ ] Clicking a filename in a message navigates the editor to that file
- [ ] File tree reflects AI-generated file changes in real time with visual markers
- [ ] Preview panel auto-refreshes after code changes
- [ ] Device size toggle (Desktop/Tablet/Phone) works correctly
- [ ] Tab mode works on mobile / narrow screens

---

## Module 4: Project Management Service

**Package:** `packages/server/`

### 4.1 Responsibility

Provides the backend API service managing user authentication, project CRUD, file persistence, conversation history, and version snapshots. Acts as the bridge between the AI engine and the frontend.

### 4.2 Public Interface (API Endpoints)

```typescript
// ==================== Auth ====================

// POST /api/auth/register
interface RegisterRequest {
  email: string
  password: string
  name: string
}
interface RegisterResponse {
  user: User
  token: string
}

// POST /api/auth/login
interface LoginRequest {
  email: string
  password: string
}
interface LoginResponse {
  user: User
  token: string
}

// POST /api/auth/github
interface GitHubAuthRequest {
  code: string
}
interface GitHubAuthResponse {
  user: User
  token: string
}

// GET /api/auth/me
interface MeResponse {
  user: User
}

// ==================== Projects ====================

// GET /api/projects
interface ListProjectsResponse {
  projects: ProjectSummary[]
}

// POST /api/projects
interface CreateProjectRequest {
  name: string
  description?: string
  template: 'blank' | 'dashboard' | 'landing' | 'ecommerce'
}
interface CreateProjectResponse {
  project: Project
}

// GET /api/projects/:id
interface GetProjectResponse {
  project: Project
  files: FileMap
}

// PATCH /api/projects/:id
interface UpdateProjectRequest {
  name?: string
  description?: string
}

// DELETE /api/projects/:id -> 204 No Content

// ==================== Files ====================

// GET /api/projects/:id/files
interface ListFilesResponse {
  tree: FileTreeNode[]
}

// GET /api/projects/:id/files/*path
interface ReadFileResponse {
  path: string
  content: string
}

// PUT /api/projects/:id/files/*path
interface WriteFileRequest {
  content: string
}

// DELETE /api/projects/:id/files/*path -> 204 No Content

// ==================== Chat ====================

// POST /api/projects/:id/chat -> SSE stream
interface ChatRequest {
  prompt: string
}
// SSE events map 1:1 with AI engine GenerateEvent:
// event: token       data: { text: "..." }
// event: file_op     data: { operation: FileOperation }
// event: validation  data: { result: ValidationResult }
// event: done        data: { operations: FileOperation[] }
// event: error       data: { error: EngineError }

// GET /api/projects/:id/messages
interface ListMessagesResponse {
  messages: Message[]
  cursor?: string
}

// ==================== Deploy ====================

// POST /api/projects/:id/deploy
interface DeployResponse {
  deployId: string
  status: 'queued'
}

// GET /api/projects/:id/deploy/status
interface DeployStatusResponse {
  status: 'queued' | 'building' | 'deploying' | 'ready' | 'failed'
  url?: string
  error?: string
}

// ==================== Snapshots ====================

// GET /api/projects/:id/snapshots
interface ListSnapshotsResponse {
  snapshots: SnapshotSummary[]
}

interface SnapshotSummary {
  id: string
  messageId: string
  description: string
  fileCount: number
  createdAt: Date
}

// POST /api/projects/:id/snapshots/:sid/restore -> 200
interface RestoreResponse {
  files: FileMap
}
```

### 4.3 Internal Architecture

```
Incoming request
    |
    v
[Hono Router]
    |
    +- authMiddleware         <- validate JWT, inject ctx.user
    +- rateLimitMiddleware    <- Redis token bucket (free: 20 req/min, pro: 100)
    +- route dispatch
        |
        +- /auth/*     -> AuthService
        |                 +- Supabase Auth (email/password, GitHub OAuth)
        |                 +- JWT signing and validation
        |
        +- /projects/* -> ProjectService
        |                 +- Drizzle ORM -> PostgreSQL
        |                 +- Project-level permission check (own projects only)
        |
        +- /files/*    -> FileService
        |                 +- PostgreSQL stores file content
        |                 +- Large files -> Supabase Storage
        |
        +- /chat       -> ChatService
        |                 +- Load project files + conversation history
        |                 +- Call ai-engine.generateCode()
        |                 +- Convert AsyncGenerator to SSE stream
        |                 +- On done: save message + update files + create snapshot (single transaction)
        |                 +- Cache recent conversations in Redis
        |
        +- /deploy     -> DeployService (Module 5)
        |
        +- /snapshots  -> SnapshotService
                          +- Store full FileMap serialized in PostgreSQL
                          +- Restore: read snapshot -> overwrite current files
```

### 4.4 Database Schema

```typescript
const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }),
  githubId: varchar('github_id', { length: 50 }).unique(),
  plan: varchar('plan', { length: 20 }).notNull().default('free'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

const projects = pgTable('projects', {
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

const files = pgTable(
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
  (t) => [unique().on(t.projectId, t.path)],
)

const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull(),
  content: text('content').notNull(),
  fileOperations: jsonb('file_operations'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

const snapshots = pgTable('snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  messageId: uuid('message_id').references(() => messages.id),
  description: varchar('description', { length: 500 }).notNull(),
  files: jsonb('files').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

const deploys = pgTable('deploys', {
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

### 4.5 Dependencies

| Dependency                    | Purpose                |
| ----------------------------- | ---------------------- |
| `hono`                        | Web framework          |
| `drizzle-orm` + `drizzle-kit` | ORM + migrations       |
| `@supabase/supabase-js`       | Auth + Storage         |
| `ioredis`                     | Redis client           |
| `packages/ai-engine`          | Calls `generateCode()` |
| `packages/shared`             | Shared types           |

**Depended on by:** `packages/web` (frontend calls via HTTP/SSE)

### 4.6 Edge Cases and Error Handling

| Scenario                                    | Handling                                                                                 |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| JWT expired                                 | Return 401; frontend redirects to login                                                  |
| Access another user's project               | ProjectService checks userId; return 403                                                 |
| SSE connection drops during AI generation   | Server detects connection close; terminates LLM stream; does not save incomplete message |
| Path traversal attack (`../../etc/passwd`)  | FileService validates path is relative with no `..` segments                             |
| Concurrent writes to same file              | Database `ON CONFLICT (project_id, path)` upsert; last writer wins                       |
| Snapshot data too large (big project)       | Single snapshot capped at 10MB; prompt user to clean up unused files                     |
| Free user exceeds project limit             | ProjectService checks user plan; free limited to 5 projects; return 403                  |
| AI generation completes but file save fails | Transaction rollback: message + files + snapshot in a single transaction for consistency |
| Conversation history too long (token bloat) | ChatService passes only the most recent 20 messages to AI engine                         |

### 4.7 Acceptance Criteria

- [ ] Users can register/login via email or GitHub
- [ ] Authenticated users can create, view, and delete their own projects
- [ ] GET `/projects/:id` returns complete file listing
- [ ] POST `/chat` returns SSE stream consumable event-by-event by the frontend
- [ ] After AI generation, message, files, and snapshot are persisted in a single transaction
- [ ] Snapshot restore returns file state matching the snapshot
- [ ] Free users are correctly rate-limited (20 req/min) and project-limited
- [ ] Path traversal and other security attacks are blocked

---

## Module 5: Deploy Service

**Package:** `packages/server/` (DeployService)

### 5.1 Responsibility

Exports user project files, executes a production build, deploys the static output to Netlify via its API, and tracks deployment status.

### 5.2 Public Interface

```typescript
interface DeployService {
  deploy(projectId: string, files: FileMap): Promise<DeployJob>
  getStatus(projectId: string): Promise<DeployStatus>
  cancel(projectId: string): Promise<void>
}

interface DeployJob {
  id: string
  projectId: string
  status: DeployPhase
  createdAt: Date
}

type DeployPhase = 'queued' | 'building' | 'uploading' | 'ready' | 'failed'

interface DeployStatus {
  phase: DeployPhase
  url?: string
  error?: string
  progress?: number // 0-100, during uploading phase
  startedAt: Date
  completedAt?: Date
}
```

### 5.3 Internal Data Flow

```
deploy(projectId, files)
    |
    v
[1] Queue  (phase: 'queued')
    +- Create DeployJob record in database
    +- If project already has an active deploy -> reject with error
    |
    v
[2] Build  (phase: 'building')
    +- Write FileMap to temp directory (os.tmpdir())
    +- Run npm install (using project's package.json)
    +- Run vite build
    +- Verify dist/ exists and is non-empty
    +- On failure -> phase: 'failed', record error
    |
    v
[3] Upload  (phase: 'uploading')
    +- Compute SHA1 digest for all files under dist/
    +- Call Netlify API: POST /sites/:siteId/deploys
    |   +- First deploy -> POST /sites to create site first
    |   +- Subsequent deploys -> reuse existing siteId (stored in project.netlifySiteId)
    +- Upload each file: PUT /deploys/:deployId/files/:path
    +- On failure -> phase: 'failed'
    |
    v
[4] Complete  (phase: 'ready')
    +- Extract url from Netlify response (xxx.netlify.app)
    +- Update project.deployUrl
    +- Clean up temp directory
    +- Return DeployStatus { phase: 'ready', url }
```

### 5.4 Netlify API Integration

```typescript
interface NetlifyClient {
  createSite(name: string): Promise<{ siteId: string; url: string }>
  createDeploy(
    siteId: string,
    fileDigests: Record<string, string>,
  ): Promise<{ deployId: string; requiredFiles: string[] }>
  uploadFile(deployId: string, path: string, content: Buffer): Promise<void>
  getDeployStatus(deployId: string): Promise<{ state: string; url: string }>
}

interface NetlifyConfig {
  authToken: string // NETLIFY_AUTH_TOKEN env var
  teamSlug?: string
}
```

### 5.5 Dependencies

| Dependency                       | Purpose                                               |
| -------------------------------- | ----------------------------------------------------- |
| Netlify REST API                 | Site creation and file upload                         |
| `vite`                           | Production build (CLI invocation)                     |
| `node:fs` + `node:child_process` | Temp directory operations and build command execution |
| `node:crypto`                    | SHA1 digest computation (required by Netlify API)     |
| `packages/shared`                | Shared types                                          |

**Depended on by:** `packages/server` route layer (`/deploy` endpoint)

### 5.6 Edge Cases and Error Handling

| Scenario                                    | Handling                                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Duplicate deploy triggered for same project | Check for existing `queued`/`building`/`uploading` job; return 409 Conflict                    |
| vite build fails                            | Capture stderr; store in deploy.error; set phase to `failed`; return error details to frontend |
| Netlify API rate limit (429)                | Exponential backoff, retry 3 times; set phase to `failed` on exhaustion                        |
| Netlify API auth failure (401)              | Set phase to `failed`; log alert to check NETLIFY_AUTH_TOKEN                                   |
| Upload interrupted by network               | Netlify supports incremental upload (only requiredFiles); retry from interruption point        |
| Build output too large (> 100MB)            | Check dist/ size after build; set phase to `failed` if over limit; prompt user to optimize     |
| Temp directory cleanup fails                | Cleanup in finally block; failure only logged, does not affect main flow                       |
| Free user deploy limit                      | 5 deploys per day (free plan); return 403 on excess                                            |

### 5.7 Acceptance Criteria

- [ ] Clicking "Publish" deploys the project to `xxx.netlify.app`
- [ ] Deploy status is queryable in real time (queued -> building -> uploading -> ready)
- [ ] Redeploying the same project reuses the Netlify site; URL stays the same
- [ ] vite build failure returns a clear error message
- [ ] Cannot trigger multiple concurrent deploys for the same project
- [ ] `project.deployUrl` is updated after successful deployment
- [ ] Temp directory is cleaned up after deployment completes
