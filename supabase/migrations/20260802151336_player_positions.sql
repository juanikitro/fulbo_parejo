alter table public.players drop constraint if exists players_preferred_position_check;

update public.players
set preferred_position = case preferred_position
  when 'goalkeeper' then 'PO'
  when 'defender' then 'DFC'
  when 'midfielder' then 'MC'
  when 'forward' then 'DC'
  else preferred_position
end;

alter table public.players
  add constraint players_preferred_position_check
  check (preferred_position in ('PO', 'DFI', 'DFC', 'DFD', 'MC', 'MD', 'MI', 'DC', 'EI', 'ED'));
