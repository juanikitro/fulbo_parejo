alter table public.roster_members rename to roster_access;
alter table public.roster_access drop constraint if exists roster_members_role_check;
update public.roster_access set role = 'technical';
alter table public.roster_access add constraint roster_access_role_check check (role in ('technical', 'player'));
alter table public.roster_access alter column role set default 'technical';

alter table public.roster_invitations add column role text not null default 'technical' check (role in ('technical', 'player'));

create or replace function public.is_roster_member(p_roster_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from public.roster_access where roster_id = p_roster_id and user_id = auth.uid());
$$;

create or replace function public.can_write_roster(p_roster_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.rosters where id = p_roster_id and owner_id = auth.uid()
    union all
    select 1 from public.roster_access where roster_id = p_roster_id and user_id = auth.uid() and role = 'technical'
  );
$$;

revoke execute on function public.can_write_roster(uuid) from public, anon;
grant execute on function public.can_write_roster(uuid) to authenticated;

create view public.roster_members as
  select roster_id, user_id, role, created_at from public.roster_access where role = 'technical';
revoke all on public.roster_members from public, anon, authenticated;
grant select on public.roster_access to authenticated;
revoke execute on function public.is_roster_member(uuid) from public, anon;
grant execute on function public.is_roster_member(uuid) to authenticated;

drop policy if exists "Members can view roster membership" on public.roster_access;
create policy "Roster access is visible to managers or self" on public.roster_access for select to authenticated
using (user_id = (select auth.uid()) or public.can_write_roster(roster_id));

drop policy if exists "Members manage players" on public.players;
drop policy if exists "Members manage matches" on public.matches;
drop policy if exists "Members manage participants" on public.match_participants;
drop policy if exists "Members manage results" on public.match_results;

create policy "Roster readers view players" on public.players for select to authenticated
using (public.is_roster_member(roster_id) or public.can_write_roster(roster_id));
create policy "Managers write players" on public.players for all to authenticated
using (public.can_write_roster(roster_id)) with check (public.can_write_roster(roster_id));
create policy "Roster readers view matches" on public.matches for select to authenticated
using (public.is_roster_member(roster_id) or public.can_write_roster(roster_id));
create policy "Managers write matches" on public.matches for all to authenticated
using (public.can_write_roster(roster_id)) with check (public.can_write_roster(roster_id));
create policy "Roster readers view participants" on public.match_participants for select to authenticated
using (exists (select 1 from public.matches where id = match_id and (public.is_roster_member(roster_id) or public.can_write_roster(roster_id))));
create policy "Managers write participants" on public.match_participants for all to authenticated
using (exists (select 1 from public.matches where id = match_id and public.can_write_roster(roster_id))) with check (exists (select 1 from public.matches where id = match_id and public.can_write_roster(roster_id)));
create policy "Roster readers view results" on public.match_results for select to authenticated
using (exists (select 1 from public.matches where id = match_id and (public.is_roster_member(roster_id) or public.can_write_roster(roster_id))));
create policy "Managers write results" on public.match_results for all to authenticated
using (exists (select 1 from public.matches where id = match_id and public.can_write_roster(roster_id))) with check (exists (select 1 from public.matches where id = match_id and public.can_write_roster(roster_id)));

drop function public.create_roster_invitation(uuid);
create function public.create_roster_invitation(p_roster_id uuid, p_role text default 'player')
returns table (token text, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_token text := encode(extensions.gen_random_bytes(32), 'hex'); v_expires_at timestamptz := now() + interval '7 days';
begin
  if p_role not in ('technical', 'player') then raise exception 'Rol de invitación inválido.'; end if;
  if not public.can_write_roster(p_roster_id) or (p_role = 'technical' and not exists (select 1 from public.rosters where id = p_roster_id and owner_id = auth.uid())) then raise exception 'No tenés permiso para invitar con ese rol.'; end if;
  insert into public.roster_invitations (roster_id, token_hash, expires_at, created_by, role) values (p_roster_id, encode(extensions.digest(v_token, 'sha256'), 'hex'), v_expires_at, auth.uid(), p_role);
  return query select v_token, v_expires_at;
end;
$$;

create or replace function public.accept_roster_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_invitation public.roster_invitations;
begin
  if auth.uid() is null then raise exception 'Iniciá sesión para aceptar la invitación.'; end if;
  select * into v_invitation from public.roster_invitations where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and accepted_at is null and expires_at > now() for update;
  if not found then raise exception 'La invitación no es válida, ya fue usada o venció.'; end if;
  insert into public.roster_access (roster_id, user_id, role) values (v_invitation.roster_id, auth.uid(), v_invitation.role) on conflict (roster_id, user_id) do nothing;
  update public.roster_invitations set accepted_at = now(), accepted_by = auth.uid() where id = v_invitation.id;
  return v_invitation.roster_id;
end;
$$;

drop function public.list_roster_access(uuid);
create function public.list_roster_access(p_roster_id uuid)
returns table (user_id uuid, display_name text, access_role text)
language sql stable security definer set search_path = '' as $$
  select roster.owner_id, coalesce(nullif(trim(owner_user.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(owner_user.raw_user_meta_data ->> 'name'), ''), 'Sin nombre visible'), 'owner'::text
  from public.rosters roster join auth.users owner_user on owner_user.id = roster.owner_id where roster.id = p_roster_id and public.can_write_roster(p_roster_id)
  union all
  select access.user_id, coalesce(nullif(trim(member_user.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(member_user.raw_user_meta_data ->> 'name'), ''), 'Sin nombre visible'), access.role
  from public.roster_access access join auth.users member_user on member_user.id = access.user_id where access.roster_id = p_roster_id and public.can_write_roster(p_roster_id)
  order by 3, 2;
$$;

create function public.update_roster_access_role(p_roster_id uuid, p_user_id uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$ begin
  if p_role not in ('technical', 'player') or not exists (select 1 from public.rosters where id = p_roster_id and owner_id = auth.uid()) then raise exception 'Solo la persona propietaria puede cambiar roles.'; end if;
  update public.roster_access set role = p_role where roster_id = p_roster_id and user_id = p_user_id;
  if not found then raise exception 'La persona ya no tiene acceso a este plantel.'; end if;
end; $$;
create function public.remove_roster_access(p_roster_id uuid, p_user_id uuid) returns void
language plpgsql security definer set search_path = public as $$ begin
  if not exists (select 1 from public.rosters where id = p_roster_id and owner_id = auth.uid()) then raise exception 'Solo la persona propietaria puede quitar accesos.'; end if;
  delete from public.roster_access where roster_id = p_roster_id and user_id = p_user_id;
  if not found then raise exception 'La persona ya no tiene acceso a este plantel.'; end if;
end; $$;
create function public.transfer_roster_ownership(p_roster_id uuid, p_new_owner_id uuid) returns void
language plpgsql security definer set search_path = public as $$ declare v_previous_owner uuid; begin
  select owner_id into v_previous_owner from public.rosters where id = p_roster_id and owner_id = auth.uid() for update;
  if not found or not exists (select 1 from public.roster_access where roster_id = p_roster_id and user_id = p_new_owner_id and role = 'technical') then raise exception 'La nueva persona propietaria debe ser parte del cuerpo técnico.'; end if;
  update public.rosters set owner_id = p_new_owner_id where id = p_roster_id;
  delete from public.roster_access where roster_id = p_roster_id and user_id = p_new_owner_id;
  insert into public.roster_access (roster_id, user_id, role) values (p_roster_id, v_previous_owner, 'technical') on conflict (roster_id, user_id) do update set role = 'technical';
end; $$;
revoke execute on function public.create_roster_invitation(uuid, text), public.accept_roster_invitation(text), public.list_roster_access(uuid), public.update_roster_access_role(uuid, uuid, text), public.remove_roster_access(uuid, uuid), public.transfer_roster_ownership(uuid, uuid) from public, anon;
grant execute on function public.create_roster_invitation(uuid, text), public.accept_roster_invitation(text), public.list_roster_access(uuid), public.update_roster_access_role(uuid, uuid, text), public.remove_roster_access(uuid, uuid), public.transfer_roster_ownership(uuid, uuid) to authenticated;
