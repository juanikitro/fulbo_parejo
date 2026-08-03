-- This table is intentionally private at the Data API level: it has RLS enabled,
-- no client grants and no client policies. Only the protected Edge Function uses
-- its service credential after it has validated the caller's user JWT.
create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role = 'superadmin'),
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
revoke all on table public.admin_users from anon, authenticated;

insert into public.admin_users (user_id, role)
values ('980c2a62-dc33-402d-abc0-05c4e480a1db', 'superadmin')
on conflict (user_id) do update set role = excluded.role;

-- These support the date/status filters used by the read-only administrative
-- endpoint without affecting the ordinary roster queries.
create index rosters_created_at_idx on public.rosters (created_at);
create index players_created_at_idx on public.players (created_at);
create index matches_created_at_status_idx on public.matches (created_at, status);
create index match_results_recorded_at_idx on public.match_results (recorded_at);
create index roster_invitations_created_at_idx on public.roster_invitations (created_at);
create index roster_invitations_accepted_at_idx on public.roster_invitations (accepted_at) where accepted_at is not null;

