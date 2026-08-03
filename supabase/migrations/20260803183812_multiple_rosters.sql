alter table public.rosters drop constraint if exists rosters_owner_id_key;
alter table public.rosters add constraint rosters_name_length check (char_length(trim(name)) between 2 and 40);

create table public.roster_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_roster_id uuid not null references public.rosters(id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table public.roster_preferences enable row level security;
grant select, insert, update on public.roster_preferences to authenticated;

create policy "People manage their active accessible roster" on public.roster_preferences for all to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.rosters
    where rosters.id = roster_preferences.active_roster_id
      and (rosters.owner_id = (select auth.uid()) or public.is_roster_member(rosters.id))
  )
);
