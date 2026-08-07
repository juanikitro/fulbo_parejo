alter table public.players
  add column secondary_position text;

alter table public.players
  add constraint players_secondary_position_check
  check (secondary_position is null or secondary_position in ('PO', 'DFI', 'DFC', 'DFD', 'MC', 'MD', 'MI', 'DC', 'EI', 'ED'));

alter table public.players
  add constraint players_secondary_position_distinct_check
  check (secondary_position is null or (preferred_position is not null and secondary_position <> preferred_position));
