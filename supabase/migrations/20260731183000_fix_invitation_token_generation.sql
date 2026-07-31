create or replace function public.create_roster_invitation(p_roster_id uuid)
returns table (token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires_at timestamptz := now() + interval '7 days';
begin
  if not exists (select 1 from public.rosters where id = p_roster_id and owner_id = auth.uid()) then
    raise exception 'Solo la persona dueña del plantel puede invitar.';
  end if;

  insert into public.roster_invitations (roster_id, token_hash, expires_at, created_by)
  values (p_roster_id, encode(extensions.digest(v_token, 'sha256'), 'hex'), v_expires_at, auth.uid());
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
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and accepted_at is null and expires_at > now()
  for update;
  if not found then raise exception 'La invitación no es válida, ya fue usada o venció.'; end if;

  insert into public.roster_members (roster_id, user_id)
  values (v_invitation.roster_id, auth.uid())
  on conflict (roster_id, user_id) do nothing;
  update public.roster_invitations set accepted_at = now(), accepted_by = auth.uid() where id = v_invitation.id;
  return v_invitation.roster_id;
end;
$$;
