do $$
declare
  invalid_values text;
begin
  select string_agg(format('%s=%s', id, base_rating), ', ' order by id)
  into invalid_values
  from (
    select id, base_rating
    from public.players
    where not (base_rating between 0 and 100)
    order by id
    limit 20
  ) invalid_players;

  if invalid_values is not null then
    raise exception 'No se puede restringir players.base_rating a 0–100. Valores fuera de rango: %. Corregilos explícitamente antes de volver a ejecutar la migración.', invalid_values;
  end if;
end $$;

alter table public.players
  drop constraint if exists players_base_rating_check,
  add constraint players_base_rating_check check (base_rating between 0 and 100);
