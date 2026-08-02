alter table public.players
  drop constraint if exists players_base_rating_check,
  drop constraint if exists players_learned_rating_check,
  drop constraint if exists players_elo_seed_check,
  alter column base_rating type numeric,
  alter column learned_rating type numeric,
  alter column elo_seed type numeric;
