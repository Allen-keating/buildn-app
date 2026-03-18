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
