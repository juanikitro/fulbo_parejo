create table public.rosters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default 'Mi plantel',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references public.rosters(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  base_rating numeric(5, 2) not null check (base_rating between 1 and 10),
  learned_rating numeric(12, 8) not null check (learned_rating between 0 and 20),
  elo_seed numeric(12, 8) not null check (elo_seed between 0 and 20),
  preferred_position text check (preferred_position in ('goalkeeper', 'defender', 'midfielder', 'forward')),
  icon text not null check (char_length(icon) between 1 and 16),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references public.rosters(id) on delete cascade,
  team_size integer not null check (team_size >= 1),
  unassigned_player_id uuid references public.players(id) on delete set null,
  status text not null default 'confirmed' check (status in ('confirmed', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.match_participants (
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  team smallint not null check (team in (1, 2)),
  ordinal smallint not null check (ordinal >= 0),
  primary key (match_id, player_id),
  unique (match_id, team, ordinal)
);

create table public.match_results (
  match_id uuid primary key references public.matches(id) on delete cascade,
  outcome text not null check (outcome in ('team_one', 'team_two', 'draw')),
  goal_difference integer check (goal_difference is null or goal_difference >= 0),
  recorded_at timestamptz not null default now()
);

create index players_roster_id_idx on public.players(roster_id);
create index matches_roster_id_created_at_idx on public.matches(roster_id, created_at);
create index match_participants_match_id_idx on public.match_participants(match_id);

alter table public.rosters enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.match_participants enable row level security;
alter table public.match_results enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.rosters, public.players, public.matches, public.match_participants, public.match_results to authenticated;

create policy "Owners manage their roster" on public.rosters
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Owners manage their players" on public.players
  for all to authenticated
  using (exists (select 1 from public.rosters where rosters.id = players.roster_id and rosters.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.rosters where rosters.id = players.roster_id and rosters.owner_id = (select auth.uid())));

create policy "Owners manage their matches" on public.matches
  for all to authenticated
  using (exists (select 1 from public.rosters where rosters.id = matches.roster_id and rosters.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.rosters where rosters.id = matches.roster_id and rosters.owner_id = (select auth.uid())));

create policy "Owners manage match participants" on public.match_participants
  for all to authenticated
  using (exists (
    select 1 from public.matches join public.rosters on rosters.id = matches.roster_id
    where matches.id = match_participants.match_id and rosters.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.matches join public.rosters on rosters.id = matches.roster_id
    where matches.id = match_participants.match_id and rosters.owner_id = (select auth.uid())
  ));

create policy "Owners manage match results" on public.match_results
  for all to authenticated
  using (exists (
    select 1 from public.matches join public.rosters on rosters.id = matches.roster_id
    where matches.id = match_results.match_id and rosters.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.matches join public.rosters on rosters.id = matches.roster_id
    where matches.id = match_results.match_id and rosters.owner_id = (select auth.uid())
  ));
