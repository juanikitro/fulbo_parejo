create table public.roster_members (
  roster_id uuid not null references public.rosters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role = 'editor'),
  created_at timestamptz not null default now(),
  primary key (roster_id, user_id)
);

create table public.roster_invitations (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references public.rosters(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index roster_members_user_id_idx on public.roster_members(user_id);
create index roster_invitations_roster_id_idx on public.roster_invitations(roster_id);

alter table public.roster_members enable row level security;
alter table public.roster_invitations enable row level security;
grant select on public.roster_members to authenticated;

create or replace function public.is_roster_member(p_roster_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.roster_members
    where roster_id = p_roster_id and user_id = auth.uid()
  );
$$;

revoke execute on function public.is_roster_member(uuid) from public, anon;
grant execute on function public.is_roster_member(uuid) to authenticated;

create or replace function public.create_roster_invitation(p_roster_id uuid)
returns table (token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := encode(gen_random_bytes(32), 'hex');
  v_expires_at timestamptz := now() + interval '7 days';
begin
  if not exists (select 1 from public.rosters where id = p_roster_id and owner_id = auth.uid()) then
    raise exception 'Solo la persona dueña del plantel puede invitar.';
  end if;

  insert into public.roster_invitations (roster_id, token_hash, expires_at, created_by)
  values (p_roster_id, encode(digest(v_token, 'sha256'), 'hex'), v_expires_at, auth.uid());
  return query select v_token, v_expires_at;
end;
$$;

create or replace function public.accept_roster_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.roster_invitations;
begin
  if auth.uid() is null then raise exception 'Iniciá sesión para aceptar la invitación.'; end if;
  select * into v_invitation
  from public.roster_invitations
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and accepted_at is null and expires_at > now()
  for update;
  if not found then raise exception 'La invitación no es válida, ya fue usada o venció.'; end if;

  insert into public.roster_members (roster_id, user_id)
  values (v_invitation.roster_id, auth.uid())
  on conflict (roster_id, user_id) do nothing;
  update public.roster_invitations
  set accepted_at = now(), accepted_by = auth.uid()
  where id = v_invitation.id;
  return v_invitation.roster_id;
end;
$$;

revoke execute on function public.create_roster_invitation(uuid) from public, anon;
revoke execute on function public.accept_roster_invitation(text) from public, anon;
grant execute on function public.create_roster_invitation(uuid), public.accept_roster_invitation(text) to authenticated;

drop policy "Owners manage their roster" on public.rosters;
drop policy "Owners manage their players" on public.players;
drop policy "Owners manage their matches" on public.matches;
drop policy "Owners manage match participants" on public.match_participants;
drop policy "Owners manage match results" on public.match_results;

create policy "Roster is visible to owner or member" on public.rosters for select to authenticated
using (owner_id = (select auth.uid()) or public.is_roster_member(id));
create policy "Owner manages roster" on public.rosters for all to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Members can view roster membership" on public.roster_members for select to authenticated
using (user_id = (select auth.uid()) or exists (select 1 from public.rosters where rosters.id = roster_members.roster_id and rosters.owner_id = (select auth.uid())));
create policy "Members manage players" on public.players for all to authenticated
using (public.is_roster_member(roster_id) or exists (select 1 from public.rosters where rosters.id = players.roster_id and rosters.owner_id = (select auth.uid())))
with check (public.is_roster_member(roster_id) or exists (select 1 from public.rosters where rosters.id = players.roster_id and rosters.owner_id = (select auth.uid())));
create policy "Members manage matches" on public.matches for all to authenticated
using (public.is_roster_member(roster_id) or exists (select 1 from public.rosters where rosters.id = matches.roster_id and rosters.owner_id = (select auth.uid())))
with check (public.is_roster_member(roster_id) or exists (select 1 from public.rosters where rosters.id = matches.roster_id and rosters.owner_id = (select auth.uid())));
create policy "Members manage participants" on public.match_participants for all to authenticated
using (exists (select 1 from public.matches where matches.id = match_participants.match_id and (public.is_roster_member(matches.roster_id) or exists (select 1 from public.rosters where rosters.id = matches.roster_id and rosters.owner_id = (select auth.uid())))))
with check (exists (select 1 from public.matches where matches.id = match_participants.match_id and (public.is_roster_member(matches.roster_id) or exists (select 1 from public.rosters where rosters.id = matches.roster_id and rosters.owner_id = (select auth.uid())))));
create policy "Members manage results" on public.match_results for all to authenticated
using (exists (select 1 from public.matches where matches.id = match_results.match_id and (public.is_roster_member(matches.roster_id) or exists (select 1 from public.rosters where rosters.id = matches.roster_id and rosters.owner_id = (select auth.uid())))))
with check (exists (select 1 from public.matches where matches.id = match_results.match_id and (public.is_roster_member(matches.roster_id) or exists (select 1 from public.rosters where rosters.id = matches.roster_id and rosters.owner_id = (select auth.uid())))));
