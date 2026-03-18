# Buildn V2 — P0: Foundation Platform Design

## Overview

Complete rewrite of Buildn as an AI-powered web application builder, modeled after industry-leading products. P0 establishes the foundational platform: Next.js monorepo, Supabase integration, authentication, project CRUD, and core page shells.

This is the first of 10 sub-projects (P0-P10) that together deliver the full product.

## Sub-Project Roadmap

| Phase | Sub-Project | Depends On |
|-------|------------|------------|
| **P0** | **Foundation Platform** (this spec) | — |
| P1 | AI Code Engine v2 | P0 |
| P2 | Sandbox & Live Preview | P0 |
| P3 | Chat UI | P1, P2 |
| P4 | Code Editor | P0 |
| P5 | Visual Editor | P3, P4 |
| P6 | GitHub Integration | P0 |
| P7 | Deploy System | P0, P2 |
| P8 | Template System | P3 |
| P9 | Billing | P0 |
| P10 | RAG + Large Project Support | P1 |

---

## Tech Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Frontend + Backend | Next.js 15 (App Router) | SSR/SEO, full-stack in one framework |
| Styling | Tailwind CSS 4 + shadcn/ui | Customizable, dark theme |
| State Management | Zustand | Lightweight |
| API Layer | tRPC | End-to-end type safety |
| Database | PostgreSQL (Supabase) | Auth + DB + Storage + RLS |
| Auth | Supabase Auth | Email + GitHub OAuth |
| ORM | Supabase client (with RLS) | No need for Drizzle when using RLS |
| Code Editor | Monaco Editor (P4) | VS Code core |
| Sandbox | WebContainer (MVP) -> E2B (later) | Free for MVP |
| AI | DashScope (Qwen) | User's existing API key |
| Monorepo | Turborepo + pnpm | Build orchestration |
| Deployment | Vercel | Best Next.js hosting |

---

## Project Structure

```
buildn-app/                          # Renamed from lovable-clone
├── apps/
│   └── web/                          # Next.js 15 (App Router)
│       ├── app/
│       │   ├── (auth)/               # Auth route group
│       │   │   ├── login/page.tsx
│       │   │   └── register/page.tsx
│       │   ├── (dashboard)/          # Authenticated route group
│       │   │   ├── layout.tsx        # Dashboard layout (header)
│       │   │   ├── page.tsx          # Project list
│       │   │   └── project/[id]/
│       │   │       └── page.tsx      # Workspace shell
│       │   ├── api/trpc/[trpc]/
│       │   │   └── route.ts          # tRPC HTTP handler
│       │   ├── layout.tsx            # Root layout
│       │   └── page.tsx              # Landing page
│       ├── components/
│       │   ├── ui/                   # shadcn/ui components
│       │   ├── auth/                 # Login/register forms
│       │   └── dashboard/            # Project cards, header
│       ├── lib/
│       │   ├── supabase/
│       │   │   ├── client.ts         # Browser Supabase client
│       │   │   ├── server.ts         # Server Supabase client (SSR)
│       │   │   └── middleware.ts      # Auth helper for middleware
│       │   ├── trpc/
│       │   │   ├── client.ts         # tRPC React client
│       │   │   ├── server.ts         # tRPC server setup + context
│       │   │   └── routers/
│       │   │       ├── project.ts    # Project CRUD router
│       │   │       └── index.ts      # Root router
│       │   └── utils.ts              # cn() helper
│       ├── middleware.ts              # Next.js middleware (auth redirect)
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       └── package.json
├── packages/
│   ├── ai-engine/                    # Stub for P1
│   ├── sandbox/                      # Stub for P2
│   └── shared/                       # Shared TypeScript types
│       └── src/types/
├── supabase/
│   ├── migrations/                   # SQL migration files
│   └── config.toml                   # Supabase local dev config
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## Database Schema

```sql
-- profiles: extends Supabase auth.users
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

-- Row Level Security
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

---

## Authentication Flow

```
Registration:
  User submits email+password (or clicks GitHub OAuth)
  -> Supabase creates auth.users row
  -> DB trigger creates profiles row
  -> Session cookie set via @supabase/ssr
  -> Redirect to /dashboard

Login:
  User submits credentials
  -> Supabase signInWithPassword / signInWithOAuth
  -> Session cookie set
  -> Redirect to /dashboard

Middleware (every request):
  -> Read Supabase session from cookie
  -> If no session + accessing (dashboard) routes -> redirect /login
  -> If session + accessing (auth) routes -> redirect /dashboard
  -> Otherwise -> pass through

Logout:
  -> Supabase signOut
  -> Cookie cleared
  -> Redirect /login
```

---

## tRPC API

```typescript
// Context: every procedure gets user + db client
type Context = {
  user: User         // From Supabase session
  profile: Profile   // From profiles table
  db: SupabaseClient // Server-side Supabase client
}

// Middleware
protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  // Verify Supabase session, fetch profile, inject into context
})

// Routers
appRouter = {
  project: {
    list:      protectedProcedure -> query   // List user's projects
    get:       protectedProcedure -> query   // Get project by ID
    create:    protectedProcedure -> mutation // Create project (check plan limit)
    update:    protectedProcedure -> mutation // Update name/description
    delete:    protectedProcedure -> mutation // Delete project (cascade)
    duplicate: protectedProcedure -> mutation // Copy project (for Remix, P8)
  }
}

// Plan limits enforced in create mutation
const PLAN_LIMITS = { free: 5, pro: 50, team: 200 }
```

---

## Pages

### 1. Landing Page (`/`)

- Dark theme, gradient hero section
- Product name: 造 Buildn
- Tagline: "用自然语言描述你的想法，Buildn 帮你变成真实的应用"
- 3 feature cards: Chat to Build, Live Preview, One-Click Deploy
- CTA: "Start Building" -> /register
- Responsive layout

### 2. Dashboard (`/dashboard`)

- Top header: logo, "My Projects", + New Project button, user avatar
- Project card grid (3 columns)
  - Each card: preview thumbnail (placeholder color), name, last updated time
  - Click -> /project/:id
- Empty state: "No projects yet" + create CTA
- "+" card for new project
- Delete via context menu on card

### 3. Workspace (`/project/:id`) — Shell only in P0

- Top bar: logo, project name, Share button, Publish button
- Three-column layout (resizable):
  - Left: File tree placeholder (P4)
  - Center: Chat/Code tab switcher placeholder (P3/P4)
  - Right: Preview placeholder (P2)
- Bottom status bar: status, file count
- All panels show "Coming in P1-P5" placeholder text

---

## Acceptance Criteria

- [ ] User can register with email/password
- [ ] User can register/login with GitHub OAuth
- [ ] Profile auto-created on signup (DB trigger)
- [ ] Login redirects to Dashboard
- [ ] Unauthenticated access to Dashboard redirects to Login
- [ ] Dashboard shows user's project list as card grid
- [ ] User can create a new project (name + template selection)
- [ ] Free plan limited to 5 projects (error shown on exceeding)
- [ ] User can click a project to enter Workspace shell
- [ ] User can delete a project from Dashboard
- [ ] Workspace shows three-column skeleton layout
- [ ] Landing page renders with product info and CTA
- [ ] All pages use dark theme, responsive on mobile
- [ ] RLS prevents users from accessing other users' data
- [ ] Deployable to Vercel
