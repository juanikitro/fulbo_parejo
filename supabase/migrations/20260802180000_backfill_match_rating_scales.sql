create temporary table affected_rating_scale_rosters on commit drop as
with updated_matches as (
  update public.matches
  set rating_scale = 100
  where rating_scale = 10
    and exists (
      select 1
      from public.match_participants
      join public.players on players.id = match_participants.player_id
      where match_participants.match_id = matches.id
        and greatest(players.base_rating, players.elo_seed) > 10
    )
  returning roster_id
)
select distinct roster_id from updated_matches;

do $$
declare
  v_match record;
begin
  for v_match in
    select match_with_result.id, match_with_result.outcome, match_with_result.goal_difference
    from affected_rating_scale_rosters
    cross join lateral (
      select matches.id, match_results.outcome, match_results.goal_difference
      from public.matches
      join public.match_results on match_results.match_id = matches.id
      where matches.roster_id = affected_rating_scale_rosters.roster_id
        and matches.status = 'completed'
      order by matches.created_at asc, matches.id asc
      limit 1
    ) as match_with_result
  loop
    perform public.manage_match_history(v_match.id, 'edit', v_match.outcome, v_match.goal_difference);
  end loop;
end;
$$;
