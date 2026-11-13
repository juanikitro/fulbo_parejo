-- Isola los objetos de dominio de Fulbo Parejo sin modificar los esquemas
-- administrados por Supabase (auth, storage, extensions, etc.).
--
-- Este corte presupone el inventario de producción del 2026-08-31. Si otro
-- objeto fue agregado a public, la migración se detiene antes de mover datos.

do $migration$
declare
  expected_tables constant text[] := array[
    'admin_users',
    'match_participants',
    'match_results',
    'matches',
    'players',
    'roster_access',
    'roster_invitations',
    'roster_preferences',
    'rosters'
  ];
  expected_functions constant text[] := array[
    'accept_roster_invitation',
    'can_write_roster',
    'create_roster_invitation',
    'is_roster_member',
    'list_roster_access',
    'manage_match_history',
    'manage_match_history_with_performance',
    'record_match',
    'remove_roster_access',
    'transfer_roster_ownership',
    'update_roster_access_role'
  ];
  found_tables text[];
  found_functions text[];
  found_views text[];
  product_table text;
  function_row record;
  definition text;
begin
  if exists (select 1 from pg_namespace where nspname = 'fulbo_parejo') then
    raise exception 'El esquema fulbo_parejo ya existe; revisar el estado antes de reintentar.';
  end if;

  select coalesce(array_agg(t.table_name order by t.table_name), '{}')
    into found_tables
    from information_schema.tables t
   where t.table_schema = 'public'
     and t.table_type = 'BASE TABLE';

  if found_tables is distinct from expected_tables then
    raise exception 'El inventario de tablas public cambió. Esperadas: %, encontradas: %', expected_tables, found_tables;
  end if;

  select coalesce(array_agg(proname order by proname), '{}')
    into found_functions
    from pg_proc
   where pronamespace = 'public'::regnamespace;

  if found_functions is distinct from expected_functions then
    raise exception 'El inventario de funciones public cambió. Esperadas: %, encontradas: %', expected_functions, found_functions;
  end if;

  select coalesce(array_agg(v.table_name order by v.table_name), '{}')
    into found_views
    from information_schema.views v
   where v.table_schema = 'public';

  if found_views is distinct from array['roster_members'] then
    raise exception 'El inventario de vistas public cambió. Esperada: roster_members; encontradas: %', found_views;
  end if;

  create schema fulbo_parejo;
  revoke all on schema fulbo_parejo from public;
  grant usage on schema fulbo_parejo to authenticated, service_role;

  foreach product_table in array expected_tables loop
    execute format('alter table public.%I set schema fulbo_parejo', product_table);
  end loop;

  -- ALTER FUNCTION conserva el OID y, con él, los privilegios y dependencias
  -- de políticas. Luego se recrea el cuerpo para eliminar public. explícito.
  for function_row in
    select
      p.oid,
      p.proname,
      pg_get_function_identity_arguments(p.oid) as identity_arguments
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
    order by case p.proname
      when 'can_write_roster' then 1
      when 'is_roster_member' then 2
      when 'accept_roster_invitation' then 3
      when 'create_roster_invitation' then 4
      when 'list_roster_access' then 5
      when 'manage_match_history' then 6
      when 'manage_match_history_with_performance' then 7
      when 'record_match' then 8
      when 'remove_roster_access' then 9
      when 'transfer_roster_ownership' then 10
      when 'update_roster_access_role' then 11
    end
  loop
    definition := pg_get_functiondef(function_row.oid);

    execute format(
      'alter function public.%I(%s) set schema fulbo_parejo',
      function_row.proname,
      function_row.identity_arguments
    );

    definition := replace(definition, 'FUNCTION public.', 'FUNCTION fulbo_parejo.');
    definition := replace(definition, 'public.', 'fulbo_parejo.');
    definition := replace(
      definition,
      'SET search_path TO ''public''',
      'SET search_path TO ''fulbo_parejo'''
    );

    execute definition;
  end loop;

  alter view public.roster_members set schema fulbo_parejo;
end;
$migration$;
