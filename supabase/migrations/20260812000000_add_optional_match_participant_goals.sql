alter table public.match_participants
  add column goals integer check (goals >= 0);

create or replace function public.record_match(
  p_roster_id uuid,
  p_team_one jsonb,
  p_team_two jsonb,
  p_unassigned_player_id uuid,
  p_outcome text,
  p_goal_difference integer,
  p_performance_ratings jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id uuid;
  v_team_one_ids uuid[];
  v_team_two_ids uuid[];
  v_player_ids uuid[];
  v_team_one numeric;
  v_team_two numeric;
  v_expected_one numeric;
  v_observed_one numeric;
  v_multiplier numeric;
  v_delta numeric;
  v_rating_scale smallint;
  v_valid_player_count integer;
  v_rating_count integer;
  v_distinct_rating_count integer;
  v_matched_rating_count integer;
  v_ratings_valid boolean;
  v_player record;
begin
  if auth.uid() is null or not public.can_write_roster(p_roster_id) then
    raise exception 'Plantel no encontrado o sin permiso.';
  end if;
  if jsonb_typeof(p_team_one) <> 'array' or jsonb_typeof(p_team_two) <> 'array' then
    raise exception 'Los equipos deben ser listas de jugadores.';
  end if;
  if p_outcome not in ('team_one', 'team_two', 'draw') then raise exception 'Resultado inválido.'; end if;
  if p_goal_difference is not null and p_goal_difference < 0 then raise exception 'La diferencia de goles no puede ser negativa.'; end if;
  if p_performance_ratings is null or jsonb_typeof(p_performance_ratings) <> 'array' then raise exception 'Las valoraciones de rendimiento son obligatorias.'; end if;

  select array_agg(value::uuid order by ordinality) into v_team_one_ids from jsonb_array_elements_text(p_team_one) with ordinality as team(value, ordinality);
  select array_agg(value::uuid order by ordinality) into v_team_two_ids from jsonb_array_elements_text(p_team_two) with ordinality as team(value, ordinality);
  if coalesce(cardinality(v_team_one_ids), 0) < 1 or cardinality(v_team_one_ids) <> cardinality(v_team_two_ids) then raise exception 'Los equipos deben tener la misma cantidad de jugadores.'; end if;
  v_player_ids := v_team_one_ids || v_team_two_ids;
  if (select count(*) from unnest(v_player_ids) as player_id) <> cardinality(v_player_ids) then raise exception 'Un jugador no puede estar en ambos equipos.'; end if;

  select count(*) into v_valid_player_count from public.players where roster_id = p_roster_id and archived_at is null and id = any(v_player_ids);
  if v_valid_player_count <> cardinality(v_player_ids) then raise exception 'Todos los jugadores deben ser activos y pertenecer al plantel.'; end if;
  if p_unassigned_player_id is not null and (p_unassigned_player_id = any(v_player_ids) or not exists (
    select 1 from public.players where id = p_unassigned_player_id and roster_id = p_roster_id and archived_at is null
  )) then raise exception 'El jugador no asignado debe ser activo, pertenecer al plantel y no jugar el partido.'; end if;

  with supplied_ratings as (
    select player_id, performance_rating, goals
    from jsonb_to_recordset(p_performance_ratings) as rating(player_id uuid, performance_rating smallint, goals integer)
  ) select count(*), count(distinct player_id), coalesce(bool_and(performance_rating between -2 and 2 and (goals is null or goals >= 0)), false)
    into v_rating_count, v_distinct_rating_count, v_ratings_valid from supplied_ratings;
  with supplied_ratings as (
    select player_id from jsonb_to_recordset(p_performance_ratings) as rating(player_id uuid, performance_rating smallint, goals integer)
  ) select count(*) into v_matched_rating_count from unnest(v_player_ids) as participant(player_id) join supplied_ratings using (player_id);
  if v_rating_count <> cardinality(v_player_ids) or v_distinct_rating_count <> cardinality(v_player_ids) or v_matched_rating_count <> cardinality(v_player_ids) or not v_ratings_valid then
    raise exception 'Las valoraciones no coinciden con los jugadores del partido.';
  end if;

  for v_player in select id from public.players where id = any(v_player_ids) order by id for update loop null; end loop;
  select case when exists (select 1 from public.players where id = any(v_player_ids) and greatest(base_rating, learned_rating, elo_seed) > 10) then 100 else 10 end into v_rating_scale;
  select avg(base_rating * 0.4 + learned_rating * 0.6) into v_team_one from public.players where id = any(v_team_one_ids);
  select avg(base_rating * 0.4 + learned_rating * 0.6) into v_team_two from public.players where id = any(v_team_two_ids);
  v_expected_one := 1 / (1 + power(10::numeric, (v_team_two - v_team_one) / (v_rating_scale / 4.0)));
  v_observed_one := case p_outcome when 'team_one' then 1 when 'team_two' then 0 else 0.5 end;
  v_multiplier := case when coalesce(p_goal_difference, 0) > 0 then least(1.5::numeric, 1 + log(2::numeric, p_goal_difference) * 0.15) else 1 end;
  v_delta := v_rating_scale * 0.024 * v_multiplier * (v_observed_one - v_expected_one);

  insert into public.matches (roster_id, team_size, unassigned_player_id, rating_scale, status)
  values (p_roster_id, cardinality(v_team_one_ids), p_unassigned_player_id, v_rating_scale, 'completed') returning id into v_match_id;
  with participants as (
    select player_id, 1::smallint as team, ordinal - 1 as ordinal from unnest(v_team_one_ids) with ordinality as player(player_id, ordinal)
    union all select player_id, 2::smallint as team, ordinal - 1 as ordinal from unnest(v_team_two_ids) with ordinality as player(player_id, ordinal)
  ), supplied_ratings as (
    select player_id, performance_rating, goals from jsonb_to_recordset(p_performance_ratings) as rating(player_id uuid, performance_rating smallint, goals integer)
  )
  insert into public.match_participants (match_id, player_id, team, ordinal, rating_offset, performance_rating, goals)
  select v_match_id, participants.player_id, participants.team, participants.ordinal,
    case when participants.team = 1 then v_delta * (1 + 0.25 * supplied_ratings.performance_rating * sign(v_delta)) else -v_delta * (1 + 0.25 * supplied_ratings.performance_rating * sign(-v_delta)) end,
    supplied_ratings.performance_rating, supplied_ratings.goals
  from participants join supplied_ratings using (player_id);
  insert into public.match_results (match_id, outcome, goal_difference) values (v_match_id, p_outcome, p_goal_difference);
  update public.players set learned_rating = players.learned_rating + match_participants.rating_offset from public.match_participants where match_participants.match_id = v_match_id and players.id = match_participants.player_id;
  return v_match_id;
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
security definer
set search_path = public
as $$
declare
  v_roster_id uuid;
  v_participant_count integer;
  v_rating_count integer;
  v_distinct_player_count integer;
  v_matched_player_count integer;
  v_ratings_valid boolean;
begin
  select roster_id into v_roster_id from public.matches where id = p_match_id;
  if v_roster_id is null or auth.uid() is null or not public.can_write_roster(v_roster_id) then raise exception 'Partido no encontrado o sin permiso.'; end if;
  if p_performance_ratings is null or jsonb_typeof(p_performance_ratings) <> 'array' then raise exception 'Las valoraciones de rendimiento son obligatorias.'; end if;
  select count(*) into v_participant_count from public.match_participants where match_id = p_match_id;
  if v_participant_count = 0 then raise exception 'El partido no tiene participantes.'; end if;
  with supplied_ratings as (
    select player_id, performance_rating, goals from jsonb_to_recordset(p_performance_ratings) as rating(player_id uuid, performance_rating smallint, goals integer)
  ) select count(*), count(distinct player_id), coalesce(bool_and(performance_rating between -2 and 2 and (goals is null or goals >= 0)), false)
    into v_rating_count, v_distinct_player_count, v_ratings_valid from supplied_ratings;
  with supplied_ratings as (
    select player_id from jsonb_to_recordset(p_performance_ratings) as rating(player_id uuid, performance_rating smallint, goals integer)
  ) select count(*) into v_matched_player_count from public.match_participants join supplied_ratings using (player_id) where match_id = p_match_id;
  if v_rating_count <> v_participant_count or v_distinct_player_count <> v_participant_count or v_matched_player_count <> v_participant_count or not v_ratings_valid then
    raise exception 'Las valoraciones no coinciden con los jugadores del partido.';
  end if;
  with supplied_ratings as (
    select player_id, performance_rating, goals from jsonb_to_recordset(p_performance_ratings) as rating(player_id uuid, performance_rating smallint, goals integer)
  ) update public.match_participants set performance_rating = supplied_ratings.performance_rating, goals = supplied_ratings.goals
  from supplied_ratings where match_participants.match_id = p_match_id and match_participants.player_id = supplied_ratings.player_id;
  perform public.manage_match_history(p_match_id, 'edit', p_outcome, p_goal_difference);
end;
$$;
