create or replace function public.list_roster_access(p_roster_id uuid)
returns table (display_name text, access_role text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(
      nullif(trim(owner_user.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(owner_user.raw_user_meta_data ->> 'name'), ''),
      'Sin nombre visible'
    ) as display_name,
    'owner'::text as access_role
  from public.rosters as roster
  join auth.users as owner_user on owner_user.id = roster.owner_id
  where roster.id = p_roster_id
    and roster.owner_id = (select auth.uid())

  union all

  select
    coalesce(
      nullif(trim(member_user.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(member_user.raw_user_meta_data ->> 'name'), ''),
      'Sin nombre visible'
    ) as display_name,
    'member'::text as access_role
  from public.roster_members as member
  join auth.users as member_user on member_user.id = member.user_id
  where member.roster_id = p_roster_id
    and exists (
      select 1
      from public.rosters as roster
      where roster.id = p_roster_id
        and roster.owner_id = (select auth.uid())
    )
  order by access_role, display_name;
$$;

revoke execute on function public.list_roster_access(uuid) from public, anon;
grant execute on function public.list_roster_access(uuid) to authenticated;
