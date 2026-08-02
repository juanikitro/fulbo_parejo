alter table public.match_participants
  add column performance_rating smallint not null default 0 check (performance_rating between -2 and 2);

create or replace function public.manage_match_history(
  p_match_id uuid,
  p_action text,
  p_outcome text default null,
  p_goal_difference integer default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_roster_id uuid;
  v_match record;
  v_team_one numeric;
  v_team_two numeric;
  v_expected_one numeric;
  v_observed_one numeric;
  v_multiplier numeric;
  v_delta numeric;
begin
  select roster_id into v_roster_id from public.matches where id = p_match_id;
  if v_roster_id is null then raise exception 'Partido no encontrado o sin permiso.'; end if;

  if p_action = 'edit' then
    if p_outcome not in ('team_one', 'team_two', 'draw') then raise exception 'Resultado inválido.'; end if;
    if p_goal_difference is not null and p_goal_difference < 0 then raise exception 'La diferencia de goles no puede ser negativa.'; end if;
    update public.match_results set outcome = p_outcome, goal_difference = p_goal_difference where match_id = p_match_id;
    if not found then raise exception 'El partido no tiene resultado para editar.'; end if;
  elsif p_action = 'delete' then
    delete from public.matches where id = p_match_id;
  else
    raise exception 'Acción inválida.';
  end if;

  update public.players set learned_rating = elo_seed where roster_id = v_roster_id;
  for v_match in
    select matches.id, match_results.outcome, match_results.goal_difference
    from public.matches join public.match_results on match_results.match_id = matches.id
    where matches.roster_id = v_roster_id and matches.status = 'completed'
    order by matches.created_at asc, matches.id asc
  loop
    select avg(players.base_rating * 0.4 + players.learned_rating * 0.6) into v_team_one
    from public.players join public.match_participants on match_participants.player_id = players.id
    where match_participants.match_id = v_match.id and match_participants.team = 1;
    select avg(players.base_rating * 0.4 + players.learned_rating * 0.6) into v_team_two
    from public.players join public.match_participants on match_participants.player_id = players.id
    where match_participants.match_id = v_match.id and match_participants.team = 2;
    if v_team_one is null or v_team_two is null then raise exception 'El partido % no tiene equipos completos.', v_match.id; end if;
    v_expected_one := 1 / (1 + power(10::numeric, (v_team_two - v_team_one) / 2.5));
    v_observed_one := case v_match.outcome when 'team_one' then 1 when 'team_two' then 0 else 0.5 end;
    v_multiplier := case when coalesce(v_match.goal_difference, 0) > 0 then least(1.5::numeric, 1 + log(2::numeric, v_match.goal_difference) * 0.15) else 1 end;
    v_delta := 0.24 * v_multiplier * (v_observed_one - v_expected_one);
    update public.match_participants
      set rating_offset = case
        when team = 1 then v_delta * (1 + 0.25 * performance_rating * sign(v_delta))
        else -v_delta * (1 + 0.25 * performance_rating * sign(-v_delta))
      end
      where match_id = v_match.id;
    update public.players
      set learned_rating = learned_rating + match_participants.rating_offset
      from public.match_participants
      where match_participants.match_id = v_match.id and players.id = match_participants.player_id;
  end loop;
end;
$$;

create or replace function public.manage_match_history_with_performance(
  p_match_id uuid,
  p_outcome text,
  p_goal_difference integer,
  p_performance_ratings jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_participant_count integer;
  v_rating_count integer;
  v_distinct_player_count integer;
  v_matched_player_count integer;
  v_ratings_valid boolean;
begin
  if p_performance_ratings is null or jsonb_typeof(p_performance_ratings) <> 'array' then
    raise exception 'Las valoraciones de rendimiento son obligatorias.';
  end if;

  select count(*) into v_participant_count from public.match_participants where match_id = p_match_id;
  if v_participant_count = 0 then raise exception 'Partido no encontrado o sin permiso.'; end if;

  with supplied_ratings as (
    select player_id, performance_rating
    from jsonb_to_recordset(p_performance_ratings) as rating(player_id uuid, performance_rating smallint)
  )
  select count(*), count(distinct player_id), coalesce(bool_and(performance_rating between -2 and 2), false)
    into v_rating_count, v_distinct_player_count, v_ratings_valid
    from supplied_ratings;

  with supplied_ratings as (
    select player_id
    from jsonb_to_recordset(p_performance_ratings) as rating(player_id uuid, performance_rating smallint)
  )
  select count(*) into v_matched_player_count
    from public.match_participants
    join supplied_ratings using (player_id)
    where match_id = p_match_id;

  if v_rating_count <> v_participant_count or v_distinct_player_count <> v_participant_count or v_matched_player_count <> v_participant_count or not v_ratings_valid then
    raise exception 'Las valoraciones no coinciden con los jugadores del partido.';
  end if;

  with supplied_ratings as (
    select player_id, performance_rating
    from jsonb_to_recordset(p_performance_ratings) as rating(player_id uuid, performance_rating smallint)
  )
  update public.match_participants
    set performance_rating = supplied_ratings.performance_rating
    from supplied_ratings
    where match_participants.match_id = p_match_id and match_participants.player_id = supplied_ratings.player_id;

  perform public.manage_match_history(p_match_id, 'edit', p_outcome, p_goal_difference);
end;
$$;

revoke execute on function public.manage_match_history_with_performance(uuid, text, integer, jsonb) from public, anon;
grant execute on function public.manage_match_history_with_performance(uuid, text, integer, jsonb) to authenticated;
