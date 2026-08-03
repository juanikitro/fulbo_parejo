-- The protected admin Edge Function reads only aggregates and paginated DTOs.
-- service_role bypasses RLS but still requires table-level SELECT privileges.
grant select on table
  public.rosters,
  public.roster_members,
  public.roster_invitations,
  public.players,
  public.matches,
  public.match_participants,
  public.match_results
to service_role;
