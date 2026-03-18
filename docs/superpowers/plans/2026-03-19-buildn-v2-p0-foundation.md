# Buildn V2 P0: Foundation Platform — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up a new Next.js 15 monorepo with Supabase auth, project CRUD via tRPC, and three core pages (Landing, Dashboard, Workspace shell).

**Architecture:** Next.js 15 App Router monorepo (Turborepo + pnpm). Supabase handles auth (email + GitHub OAuth) and PostgreSQL with RLS. tRPC provides type-safe API layer. shadcn/ui for dark-themed UI components.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS 4, shadcn/ui, tRPC, Supabase (Auth + PostgreSQL + RLS), Turborepo, pnpm, Vercel

---

## File Structure

```
v2/                                    # New directory inside buildn-app
├── apps/
│   └── web/
│       ├── app/
│       │   ├── (auth)/
│       │   │   ├── login/page.tsx
│       │   │   └── register/page.tsx
│       │   ├── (dashboard)/
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx
│       │   │   └── project/[id]/page.tsx
│       │   ├── api/trpc/[trpc]/route.ts
│       │   ├── layout.tsx
│       │   ├── page.tsx
│       │   └── globals.css
│       ├── components/
│       │   ├── ui/                    # shadcn/ui (button, card, input, dialog, dropdown-menu, avatar)
│       │   ├── auth/
│       │   │   ├── login-form.tsx
│       │   │   ├── register-form.tsx
│       │   │   ├── oauth-button.tsx
│       │   │   └── logout-button.tsx
│       │   └── dashboard/
│       │       ├── header.tsx
│       │       ├── project-card.tsx
│       │       ├── new-project-card.tsx
│       │       ├── create-project-dialog.tsx
│       │       └── workspace-shell.tsx
│       ├── lib/
│       │   ├── supabase/
│       │   │   ├── client.ts
│       │   │   ├── server.ts
│       │   │   └── middleware.ts
│       │   ├── trpc/
│       │   │   ├── client.ts
│       │   │   ├── server.ts
│       │   │   ├── provider.tsx
│       │   │   └── routers/
│       │   │       ├── project.ts
│       │   │       └── index.ts
│       │   └── utils.ts
│       ├── middleware.ts
│       ├── next.config.ts
│       ├── postcss.config.mjs
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   └── shared/
│       ├── src/
│       │   └── types.ts
│       ├── tsconfig.json
│       └── package.json
├── supabase/
│   └── migrations/
│       └── 00001_initial.sql
├── .env.local.example
├── .gitignore
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

---

## Task 1: Monorepo Scaffolding

**Files:**
- Create: `v2/package.json`
- Create: `v2/pnpm-workspace.yaml`
- Create: `v2/turbo.json`
- Create: `v2/.gitignore`
- Create: `v2/.env.local.example`
- Create: `v2/packages/shared/package.json`
- Create: `v2/packages/shared/tsconfig.json`
- Create: `v2/packages/shared/src/types.ts`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "buildn-v2",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck"
  },
  "devDependencies": {
    "turbo": "^2",
    "typescript": "^5.7"
  },
  "packageManager": "pnpm@9.15.4"
}
```

- [ ] **Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 3: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": { "dependsOn": ["^build"] },
    "typecheck": { "dependsOn": ["^build"] }
  }
}
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
.next/
dist/
.env
.env.local
.turbo/
.superpowers/
*.tgz
.DS_Store
```

- [ ] **Step 5: Create .env.local.example**

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

DASHSCOPE_API_KEY=sk-xxx
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

- [ ] **Step 6: Create packages/shared**

`packages/shared/package.json`:
```json
{
  "name": "@buildn/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": { ".": { "types": "./src/types.ts" } },
  "scripts": { "typecheck": "tsc --noEmit" },
  "devDependencies": { "typescript": "^5.7" }
}
```

`packages/shared/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "bundler",
    "strict": true, "skipLibCheck": true, "composite": true,
    "outDir": "dist", "rootDir": "src"
  },
  "include": ["src"]
}
```

`packages/shared/src/types.ts`:
```typescript
export interface Profile {
  id: string
  name: string
  avatar_url: string | null
  plan: 'free' | 'pro' | 'team'
  created_at: string
}

export interface Project {
  id: string
  user_id: string
  name: string
  description: string
  template: string
  status: 'draft' | 'published'
  deploy_url: string | null
  github_repo: string | null
  created_at: string
  updated_at: string
}

export const PLAN_LIMITS = { free: 5, pro: 50, team: 200 } as const
```

- [ ] **Step 7: Install and verify**

```bash
cd v2 && pnpm install && pnpm typecheck
```

- [ ] **Step 8: Commit**

```bash
git add v2/ && git commit -m "chore: scaffold v2 monorepo with Turborepo"
```

---

## Task 2: Next.js App Scaffolding

**Files:**
- Create: `v2/apps/web/package.json`
- Create: `v2/apps/web/tsconfig.json`
- Create: `v2/apps/web/next.config.ts`
- Create: `v2/apps/web/postcss.config.mjs`
- Create: `v2/apps/web/tailwind.config.ts`
- Create: `v2/apps/web/app/globals.css`
- Create: `v2/apps/web/app/layout.tsx`
- Create: `v2/apps/web/app/page.tsx`
- Create: `v2/apps/web/lib/utils.ts`

- [ ] **Step 1: Create apps/web/package.json**

```json
{
  "name": "@buildn/web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^15",
    "react": "^19",
    "react-dom": "^19",
    "class-variance-authority": "^0.7",
    "clsx": "^2",
    "tailwind-merge": "^3",
    "lucide-react": "^0.577"
  },
  "devDependencies": {
    "@buildn/shared": "workspace:*",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "tailwindcss": "^4",
    "@tailwindcss/postcss": "^4",
    "typescript": "^5.7"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create next.config.ts**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@buildn/shared'],
}

export default nextConfig
```

- [ ] **Step 4: Create postcss.config.mjs**

```javascript
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
export default config
```

- [ ] **Step 5: Create tailwind.config.ts**

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}

export default config
```

- [ ] **Step 6: Create app/globals.css**

```css
@import 'tailwindcss';
```

- [ ] **Step 7: Create lib/utils.ts**

```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 8: Create app/layout.tsx**

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '造 Buildn',
  description: 'AI-powered web application builder',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-neutral-950 text-white antialiased`}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 9: Create app/page.tsx (Landing Page)**

```tsx
import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-xl font-bold">造 Buildn</span>
        <div className="flex gap-3">
          <Link href="/login" className="rounded-lg px-4 py-2 text-sm text-neutral-400 hover:text-white">
            Sign In
          </Link>
          <Link href="/register" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">
            Get Started
          </Link>
        </div>
      </header>

      <main className="flex flex-col items-center px-6 pt-24 text-center">
        <p className="mb-3 text-sm tracking-widest text-neutral-500">AI-POWERED APP BUILDER</p>
        <h1 className="mb-4 text-5xl font-extrabold tracking-tight">Build apps with words</h1>
        <p className="mb-8 max-w-lg text-lg text-neutral-400">
          Describe what you want, and Buildn turns it into a real web application.
        </p>
        <Link href="/register" className="rounded-xl bg-blue-600 px-8 py-3 text-lg font-semibold text-white hover:bg-blue-500">
          Start Building
        </Link>

        <div className="mt-24 grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            { icon: '💬', title: 'Chat to Build', desc: 'Describe your app in natural language' },
            { icon: '👁️', title: 'Live Preview', desc: 'See changes in real-time' },
            { icon: '🚀', title: 'One-Click Deploy', desc: 'Publish to the web instantly' },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
              <div className="mb-3 text-2xl">{f.icon}</div>
              <h3 className="mb-1 font-semibold">{f.title}</h3>
              <p className="text-sm text-neutral-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 10: Install, build, verify**

```bash
cd v2 && pnpm install && cd apps/web && pnpm build
```
Expected: Next.js build succeeds

- [ ] **Step 11: Commit**

```bash
git add v2/apps/web/ && git commit -m "feat(v2): scaffold Next.js 15 app with landing page"
```

---

## Task 3: Supabase Setup & Database Migration

**Files:**
- Create: `v2/supabase/migrations/00001_initial.sql`
- Modify: `v2/apps/web/package.json` (add supabase deps)
- Create: `v2/apps/web/lib/supabase/client.ts`
- Create: `v2/apps/web/lib/supabase/server.ts`
- Create: `v2/apps/web/lib/supabase/middleware.ts`

- [ ] **Step 1: Add Supabase dependencies**

Add to `apps/web/package.json` dependencies:
```json
"@supabase/supabase-js": "^2",
"@supabase/ssr": "^0.5"
```

- [ ] **Step 2: Create migration file**

`v2/supabase/migrations/00001_initial.sql`:
```sql
-- profiles
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text not null,
  avatar_url    text,
  plan          text not null default 'free',
  created_at    timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- projects
create table projects (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  description   text default '',
  template      text not null default 'blank',
  status        text not null default 'draft',
  deploy_url    text,
  github_repo   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- files
create table files (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  path          text not null,
  content       text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(project_id, path)
);

-- messages
create table messages (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  role          text not null,
  content       text not null,
  file_ops      jsonb,
  created_at    timestamptz not null default now()
);

-- snapshots
create table snapshots (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  message_id    uuid references messages(id),
  description   text not null,
  files         jsonb not null,
  created_at    timestamptz not null default now()
);

-- RLS
alter table profiles enable row level security;
create policy "Users can read own profile" on profiles for select using (id = auth.uid());
create policy "Users can update own profile" on profiles for update using (id = auth.uid());

alter table projects enable row level security;
create policy "Users can CRUD own projects" on projects for all using (user_id = auth.uid());

alter table files enable row level security;
create policy "Users can CRUD own project files" on files for all
  using (project_id in (select id from projects where user_id = auth.uid()));

alter table messages enable row level security;
create policy "Users can CRUD own project messages" on messages for all
  using (project_id in (select id from projects where user_id = auth.uid()));

alter table snapshots enable row level security;
create policy "Users can CRUD own project snapshots" on snapshots for all
  using (project_id in (select id from projects where user_id = auth.uid()));
```

- [ ] **Step 3: Create Supabase browser client**

`v2/apps/web/lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

- [ ] **Step 4: Create Supabase server client**

`v2/apps/web/lib/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Server Component — ignore
          }
        },
      },
    },
  )
}
```

- [ ] **Step 5: Create Supabase middleware helper**

`v2/apps/web/lib/supabase/middleware.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/register')
  const isDashboardRoute = request.nextUrl.pathname.startsWith('/project') ||
    request.nextUrl.pathname === '/dashboard' ||
    (request.nextUrl.pathname === '/' && false) // Landing is public

  if (!user && isDashboardRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

- [ ] **Step 6: Install and typecheck**

```bash
cd v2 && pnpm install && cd apps/web && pnpm typecheck
```

- [ ] **Step 7: Commit**

```bash
git add v2/ && git commit -m "feat(v2): add Supabase client setup and initial DB migration"
```

---

## Task 4: Auth Middleware & Pages

**Files:**
- Create: `v2/apps/web/middleware.ts`
- Create: `v2/apps/web/components/auth/login-form.tsx`
- Create: `v2/apps/web/components/auth/register-form.tsx`
- Create: `v2/apps/web/components/auth/oauth-button.tsx`
- Create: `v2/apps/web/components/auth/logout-button.tsx`
- Create: `v2/apps/web/app/(auth)/login/page.tsx`
- Create: `v2/apps/web/app/(auth)/register/page.tsx`

- [ ] **Step 1: Create Next.js middleware**

`v2/apps/web/middleware.ts`:
```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
```

- [ ] **Step 2: Install shadcn/ui components needed for auth**

```bash
cd v2/apps/web
npx shadcn@latest init --defaults --force
npx shadcn@latest add button input card label
```

- [ ] **Step 3: Create oauth-button.tsx**

```tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export function OAuthButton() {
  async function handleGitHubLogin() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <Button variant="outline" className="w-full" onClick={handleGitHubLogin}>
      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
      Continue with GitHub
    </Button>
  )
}
```

- [ ] **Step 4: Create login-form.tsx**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Signing in...' : 'Sign In'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 5: Create register-form.tsx**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function RegisterForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Creating account...' : 'Create Account'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 6: Create logout-button.tsx**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button onClick={handleLogout} className="text-sm text-neutral-400 hover:text-white">
      Sign Out
    </button>
  )
}
```

- [ ] **Step 7: Create login page**

`v2/apps/web/app/(auth)/login/page.tsx`:
```tsx
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoginForm } from '@/components/auth/login-form'
import { OAuthButton } from '@/components/auth/oauth-button'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950">
      <Card className="w-96 border-neutral-800 bg-neutral-900">
        <CardHeader className="text-center">
          <div className="mb-2 text-2xl font-bold">造 Buildn</div>
          <CardTitle className="text-base font-normal text-neutral-400">Sign in to your account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <OAuthButton />
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-neutral-800" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-neutral-900 px-2 text-neutral-500">or</span></div>
          </div>
          <LoginForm />
          <p className="text-center text-sm text-neutral-500">
            Don&apos;t have an account? <Link href="/register" className="text-blue-400 hover:underline">Register</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 8: Create register page**

`v2/apps/web/app/(auth)/register/page.tsx`:
```tsx
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RegisterForm } from '@/components/auth/register-form'
import { OAuthButton } from '@/components/auth/oauth-button'

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950">
      <Card className="w-96 border-neutral-800 bg-neutral-900">
        <CardHeader className="text-center">
          <div className="mb-2 text-2xl font-bold">造 Buildn</div>
          <CardTitle className="text-base font-normal text-neutral-400">Create your account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <OAuthButton />
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-neutral-800" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-neutral-900 px-2 text-neutral-500">or</span></div>
          </div>
          <RegisterForm />
          <p className="text-center text-sm text-neutral-500">
            Already have an account? <Link href="/login" className="text-blue-400 hover:underline">Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 9: Create OAuth callback route**

`v2/apps/web/app/auth/callback/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(origin)
}
```

- [ ] **Step 10: Typecheck and commit**

```bash
cd v2 && pnpm install && cd apps/web && pnpm typecheck
git add v2/ && git commit -m "feat(v2): add auth pages, middleware, and Supabase OAuth"
```

---

## Task 5: tRPC Setup

**Files:**
- Create: `v2/apps/web/lib/trpc/server.ts`
- Create: `v2/apps/web/lib/trpc/client.ts`
- Create: `v2/apps/web/lib/trpc/provider.tsx`
- Create: `v2/apps/web/lib/trpc/routers/index.ts`
- Create: `v2/apps/web/lib/trpc/routers/project.ts`
- Create: `v2/apps/web/app/api/trpc/[trpc]/route.ts`
- Modify: `v2/apps/web/app/layout.tsx` (wrap with TRPCProvider)

- [ ] **Step 1: Add tRPC dependencies**

Add to `apps/web/package.json` dependencies:
```json
"@trpc/server": "^11",
"@trpc/client": "^11",
"@trpc/react-query": "^11",
"@tanstack/react-query": "^5",
"superjson": "^2",
"zod": "^3"
```

- [ ] **Step 2: Create tRPC server setup**

`v2/apps/web/lib/trpc/server.ts`:
```typescript
import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { createClient } from '@/lib/supabase/server'

export const createTRPCContext = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

const t = initTRPC.context<Awaited<ReturnType<typeof createTRPCContext>>>().create({
  transformer: superjson,
})

export const router = t.router
export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  const { data: profile } = await ctx.supabase
    .from('profiles')
    .select('*')
    .eq('id', ctx.user.id)
    .single()

  if (!profile) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Profile not found' })
  }

  return next({ ctx: { ...ctx, user: ctx.user, profile } })
})
```

- [ ] **Step 3: Create project router**

`v2/apps/web/lib/trpc/routers/project.ts`:
```typescript
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../server'
import { PLAN_LIMITS } from '@buildn/shared'

export const projectRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false })
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
    return data
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('projects')
        .select('*')
        .eq('id', input.id)
        .single()
      if (error || !data) throw new TRPCError({ code: 'NOT_FOUND' })
      return data
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      template: z.enum(['blank', 'dashboard', 'landing', 'ecommerce']).default('blank'),
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = ctx.profile.plan as keyof typeof PLAN_LIMITS
      const limit = PLAN_LIMITS[plan] ?? 5

      const { count } = await ctx.supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })

      if ((count ?? 0) >= limit) {
        throw new TRPCError({ code: 'FORBIDDEN', message: `Project limit reached (${limit} for ${plan} plan)` })
      }

      const { data, error } = await ctx.supabase
        .from('projects')
        .insert({ user_id: ctx.user.id, name: input.name, template: input.template })
        .select()
        .single()
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return data
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input
      const { data, error } = await ctx.supabase
        .from('projects')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error || !data) throw new TRPCError({ code: 'NOT_FOUND' })
      return data
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('projects')
        .delete()
        .eq('id', input.id)
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { success: true }
    }),
})
```

- [ ] **Step 4: Create root router**

`v2/apps/web/lib/trpc/routers/index.ts`:
```typescript
import { router } from '../server'
import { projectRouter } from './project'

export const appRouter = router({
  project: projectRouter,
})

export type AppRouter = typeof appRouter
```

- [ ] **Step 5: Create tRPC API route handler**

`v2/apps/web/app/api/trpc/[trpc]/route.ts`:
```typescript
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/lib/trpc/routers'
import { createTRPCContext } from '@/lib/trpc/server'

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: createTRPCContext,
  })

export { handler as GET, handler as POST }
```

- [ ] **Step 6: Create tRPC React client**

`v2/apps/web/lib/trpc/client.ts`:
```typescript
import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from './routers'

export const trpc = createTRPCReact<AppRouter>()
```

- [ ] **Step 7: Create tRPC provider**

`v2/apps/web/lib/trpc/provider.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'
import superjson from 'superjson'
import { trpc } from './client'

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          transformer: superjson,
        }),
      ],
    }),
  )

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  )
}
```

- [ ] **Step 8: Wrap root layout with TRPCProvider**

Update `v2/apps/web/app/layout.tsx` body:
```tsx
import { TRPCProvider } from '@/lib/trpc/provider'

// In the body:
<TRPCProvider>
  {children}
</TRPCProvider>
```

- [ ] **Step 9: Install, typecheck, commit**

```bash
cd v2 && pnpm install && cd apps/web && pnpm typecheck
git add v2/ && git commit -m "feat(v2): add tRPC API layer with project CRUD router"
```

---

## Task 6: Dashboard Page

**Files:**
- Create: `v2/apps/web/components/dashboard/header.tsx`
- Create: `v2/apps/web/components/dashboard/project-card.tsx`
- Create: `v2/apps/web/components/dashboard/new-project-card.tsx`
- Create: `v2/apps/web/components/dashboard/create-project-dialog.tsx`
- Create: `v2/apps/web/app/(dashboard)/layout.tsx`
- Create: `v2/apps/web/app/(dashboard)/page.tsx`

- [ ] **Step 1: Install additional shadcn/ui components**

```bash
cd v2/apps/web
npx shadcn@latest add dialog dropdown-menu avatar
```

- [ ] **Step 2: Create header.tsx**

```tsx
import Link from 'next/link'
import { LogoutButton } from '@/components/auth/logout-button'

export function DashboardHeader() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-neutral-800 bg-neutral-950 px-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-lg font-bold text-white">造</Link>
        <span className="text-sm text-neutral-500">My Projects</span>
      </div>
      <div className="flex items-center gap-4">
        <LogoutButton />
      </div>
    </header>
  )
}
```

- [ ] **Step 3: Create project-card.tsx**

```tsx
'use client'

import Link from 'next/link'
import type { Project } from '@buildn/shared'

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function ProjectCard({ project, onDelete }: { project: Project; onDelete: () => void }) {
  return (
    <div className="group relative">
      <Link
        href={`/project/${project.id}`}
        className="block rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition hover:border-neutral-700"
      >
        <div className="mb-3 h-20 rounded-lg bg-gradient-to-br from-neutral-800 to-neutral-900" />
        <h3 className="font-medium text-white">{project.name}</h3>
        <p className="mt-1 text-xs text-neutral-500">{timeAgo(project.updated_at)}</p>
      </Link>
      <button
        onClick={(e) => { e.preventDefault(); onDelete() }}
        className="absolute right-3 top-3 hidden rounded-md p-1 text-neutral-500 hover:bg-neutral-800 hover:text-white group-hover:block"
      >
        &times;
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Create new-project-card.tsx**

```tsx
export function NewProjectCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-full min-h-[140px] items-center justify-center rounded-xl border border-dashed border-neutral-700 bg-neutral-900/50 transition hover:border-neutral-600"
    >
      <div className="text-center text-neutral-500">
        <div className="text-2xl">+</div>
        <div className="mt-1 text-sm">New Project</div>
      </div>
    </button>
  )
}
```

- [ ] **Step 5: Create create-project-dialog.tsx**

```tsx
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (name: string, template: string) => void
}

export function CreateProjectDialog({ open, onOpenChange, onCreate }: Props) {
  const [name, setName] = useState('')
  const [template, setTemplate] = useState('blank')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onCreate(name.trim(), template)
    setName('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-neutral-800 bg-neutral-900">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My awesome app" required />
          </div>
          <div className="space-y-2">
            <Label>Template</Label>
            <div className="grid grid-cols-2 gap-2">
              {['blank', 'dashboard', 'landing', 'ecommerce'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTemplate(t)}
                  className={`rounded-lg border p-3 text-left text-sm capitalize ${template === t ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-neutral-700 text-neutral-400 hover:border-neutral-600'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" className="w-full">Create Project</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 6: Create dashboard layout**

`v2/apps/web/app/(dashboard)/layout.tsx`:
```tsx
import { DashboardHeader } from '@/components/dashboard/header'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-950">
      <DashboardHeader />
      {children}
    </div>
  )
}
```

- [ ] **Step 7: Create dashboard page**

`v2/apps/web/app/(dashboard)/page.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/lib/trpc/client'
import { ProjectCard } from '@/components/dashboard/project-card'
import { NewProjectCard } from '@/components/dashboard/new-project-card'
import { CreateProjectDialog } from '@/components/dashboard/create-project-dialog'
import { Button } from '@/components/ui/button'

export default function DashboardPage() {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: projects, refetch } = trpc.project.list.useQuery()
  const createMutation = trpc.project.create.useMutation({
    onSuccess: (project) => {
      router.push(`/project/${project.id}`)
    },
  })
  const deleteMutation = trpc.project.delete.useMutation({
    onSuccess: () => refetch(),
  })

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-xl font-semibold">My Projects</h1>
        <Button onClick={() => setDialogOpen(true)}>+ New Project</Button>
      </div>

      {projects?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-neutral-500">
          <p className="mb-4 text-lg">No projects yet</p>
          <Button onClick={() => setDialogOpen(true)}>Create your first project</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects?.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onDelete={() => deleteMutation.mutate({ id: p.id })}
            />
          ))}
          <NewProjectCard onClick={() => setDialogOpen(true)} />
        </div>
      )}

      <CreateProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreate={(name, template) =>
          createMutation.mutate({ name, template: template as 'blank' | 'dashboard' | 'landing' | 'ecommerce' })
        }
      />
    </div>
  )
}
```

- [ ] **Step 8: Typecheck and commit**

```bash
cd v2/apps/web && pnpm typecheck
git add v2/ && git commit -m "feat(v2): add dashboard page with project cards and create dialog"
```

---

## Task 7: Workspace Shell Page

**Files:**
- Create: `v2/apps/web/components/dashboard/workspace-shell.tsx`
- Create: `v2/apps/web/app/(dashboard)/project/[id]/page.tsx`

- [ ] **Step 1: Install react-resizable-panels**

```bash
cd v2/apps/web && pnpm add react-resizable-panels
```

- [ ] **Step 2: Create workspace-shell.tsx**

```tsx
'use client'

import Link from 'next/link'
import { Group, Panel, Separator } from 'react-resizable-panels'
import type { Project } from '@buildn/shared'

export function WorkspaceShell({ project }: { project: Project }) {
  return (
    <div className="flex h-screen flex-col bg-neutral-950 text-white">
      {/* Top bar */}
      <div className="flex h-11 items-center justify-between border-b border-neutral-800 px-4">
        <div className="flex items-center gap-2">
          <Link href="/" className="font-bold">造</Link>
          <span className="text-neutral-600">/</span>
          <span className="text-sm text-neutral-400">{project.name}</span>
        </div>
        <div className="flex gap-2">
          <button className="rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-400 hover:text-white">Share</button>
          <button className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-500">Publish</button>
        </div>
      </div>

      {/* Three-column layout */}
      <Group orientation="horizontal" className="flex-1">
        <Panel defaultSize={15} minSize={10} maxSize={25}>
          <div className="flex h-full flex-col border-r border-neutral-800 bg-neutral-950">
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">Files</div>
            <div className="flex flex-1 items-center justify-center text-xs text-neutral-600">Coming in P4</div>
          </div>
        </Panel>
        <Separator className="w-px bg-neutral-800 hover:bg-blue-600" />
        <Panel defaultSize={42} minSize={25}>
          <div className="flex h-full flex-col">
            <div className="flex border-b border-neutral-800">
              <div className="border-b-2 border-blue-500 px-4 py-2 text-xs text-white">Chat</div>
              <div className="px-4 py-2 text-xs text-neutral-600">Code</div>
            </div>
            <div className="flex flex-1 items-center justify-center text-xs text-neutral-600">Coming in P3</div>
          </div>
        </Panel>
        <Separator className="w-px bg-neutral-800 hover:bg-blue-600" />
        <Panel defaultSize={43} minSize={20}>
          <div className="flex h-full items-center justify-center bg-neutral-900 text-xs text-neutral-600">Coming in P2</div>
        </Panel>
      </Group>

      {/* Status bar */}
      <div className="flex h-6 items-center gap-4 border-t border-neutral-800 px-4 text-[10px] text-neutral-600">
        <span>Ready</span>
        <span>0 files</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create workspace page**

`v2/apps/web/app/(dashboard)/project/[id]/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WorkspaceShell } from '@/components/dashboard/workspace-shell'

export default async function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (!project) redirect('/')

  return <WorkspaceShell project={project} />
}
```

- [ ] **Step 4: Typecheck, build, commit**

```bash
cd v2/apps/web && pnpm typecheck && pnpm build
git add v2/ && git commit -m "feat(v2): add workspace shell with three-column resizable layout"
```

---

## Task 8: Final Verification

- [ ] **Step 1: Full monorepo typecheck**

```bash
cd v2 && pnpm typecheck
```
Expected: All packages pass

- [ ] **Step 2: Full build**

```bash
cd v2 && pnpm build
```
Expected: Next.js build succeeds

- [ ] **Step 3: Verify dev server starts**

```bash
cd v2/apps/web && pnpm dev
```
Expected: Server starts at http://localhost:3000

Open and verify:
- `/` — Landing page renders
- `/login` — Login form renders
- `/register` — Register form renders

- [ ] **Step 4: Final commit**

```bash
git add -A && git diff --cached --quiet || git commit -m "chore(v2): final verification pass"
```
