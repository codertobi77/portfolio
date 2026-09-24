-- Portfolio schema: projects mini-CMS, guestbook, contact messages.
-- Security model:
--   - projects:       public SELECT on published rows only
--   - guestbook:      public INSERT (pending approval) + SELECT approved
--   - contact_messages: public INSERT only, no public SELECT
-- RLS is enabled on every table (public schema is exposed by default).

-- ---------- projects (mini-CMS) ----------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  title_en text,
  description text not null,
  description_en text,
  tags text[] not null default '{}',
  url text,
  repo_url text,
  featured boolean not null default false,
  published boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "published_projects_select"
  on public.projects
  for select
  to anon, authenticated
  using (published = true);

-- ---------- guestbook ----------
create table if not exists public.guestbook (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  message text not null check (char_length(message) between 1 and 500),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.guestbook enable row level security;

-- Anyone can sign; entries land as unapproved (moderation via dashboard).
create policy "guestbook_insert"
  on public.guestbook
  for insert
  to anon, authenticated
  with check (approved = false);

create policy "guestbook_select_approved"
  on public.guestbook
  for select
  to anon, authenticated
  using (approved = true);

create index if not exists guestbook_approved_created_idx
  on public.guestbook (approved, created_at desc);

-- ---------- contact_messages ----------
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  subject text check (char_length(subject) <= 200),
  message text not null check (char_length(message) between 1 and 5000),
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

-- INSERT only: anon can never read messages back.
create policy "contact_messages_insert"
  on public.contact_messages
  for insert
  to anon, authenticated
  with check (true);

-- ---------- Data API exposure ----------
-- Depending on project Data API settings, tables may not be exposed by default;
-- explicit grants guarantee anon/authenticated access matching the policies above.
grant usage on schema public to anon, authenticated;
grant select on public.projects to anon, authenticated;
grant select on public.guestbook to anon, authenticated;
grant insert on public.guestbook to anon, authenticated;
grant insert on public.contact_messages to anon, authenticated;
