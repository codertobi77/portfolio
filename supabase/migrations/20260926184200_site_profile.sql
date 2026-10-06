-- Site profile overrides: runtime-editable persona data for the portfolio.
-- The Studio shell `profile` commands write the full merged persona here
-- (service-role client, owner-only via sudo); public pages read it and
-- deep-merge over the content/profile.json defaults.
--
-- Security model:
--   - site_profile: public SELECT (non-sensitive persona data)
--   - writes: owner-only, through the service-role client (no anon grants)

create table if not exists public.site_profile (
  key text primary key default 'profile',
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.site_profile enable row level security;

create policy "site_profile_select"
  on public.site_profile
  for select
  to anon, authenticated
  using (true);

-- Data API exposure: explicit grant guarantees anon/authenticated SELECT
-- matching the policy above (mirrors the init migration's approach).
grant select on public.site_profile to anon, authenticated;
