import type { ChemistryMatch } from '../domain/chemistry'
import type { Player, Position, Team } from '../domain/types'
import type { PerformanceRating, RecordedResult } from '../domain/elo'
import { supabase } from './supabase'
import type { RosterAccessEntry, RosterRole } from './rosterAccess'

type PlayerRow = {
  id: string
  name: string
  base_rating: number | string
  learned_rating: number | string
  elo_seed: number | string
  preferred_position: Position | null
  secondary_position: Position | null
  icon: string
  color: string
  archived_at: string | null
}

export type HistoryEntry = {
  id: string
  createdAt: string
  outcome: 'team_one' | 'team_two' | 'draw'
  goalDifference: number | null
  playerOffsets: { playerId: string; playerName: string; offset: number; performanceRating: PerformanceRating; goals?: number | null }[]
}
export type PlayerMatchHistoryEntry = {
  id: string
  createdAt: string
  result: 'win' | 'loss' | 'draw'
  goalDifference: number | null
  offset: number
  performanceRating: PerformanceRating
  goals?: number | null
}
export type RosterSummary = { id: string; name: string; ownerId: string }
export type HistoryPage = { entries: HistoryEntry[]; hasMore: boolean }
type HistoryResult = { outcome: HistoryEntry['outcome']; goal_difference: number | null }
type HistoryParticipant = { rating_offset: number | string; performance_rating: PerformanceRating; goals?: number | string | null; players: { id: string; name: string } | { id: string; name: string }[] | null }
type HistoryRow = { id: string; created_at: string; match_results: HistoryResult | HistoryResult[] | null; match_participants: HistoryParticipant[] | null }
type ChemistryHistoryRow = { match_results: { outcome: ChemistryMatch['outcome'] } | { outcome: ChemistryMatch['outcome'] }[] | null; match_participants: { player_id: string; team: 1 | 2 }[] | null }
type PlayerHistoryRow = { match_id: string; team: 1 | 2; rating_offset: number | string; performance_rating: PerformanceRating; goals?: number | string | null; matches: { created_at: string; match_results: HistoryResult | HistoryResult[] | null } | { created_at: string; match_results: HistoryResult | HistoryResult[] | null }[] | null }
type PlayerGoalRow = { player_id: string; goals: number | string | null }

const client = () => {
  if (!supabase) throw new Error('Falta configurar Supabase.')
  return supabase
}

const fromRow = (row: PlayerRow): Player => ({
  id: row.id,
  name: row.name,
  baseRating: Number(row.base_rating),
  learnedRating: Number(row.learned_rating),
  eloSeed: Number(row.elo_seed),
  preferredPosition: row.preferred_position ?? undefined,
  secondaryPosition: row.secondary_position ?? undefined,
  icon: row.icon,
  color: row.color,
  archived: Boolean(row.archived_at),
})

export function rosterNameError(value: string) {
  const name = value.trim()
  if (name.length < 2) return 'Usá al menos 2 caracteres.'
  if (name.length > 40) return 'Usá como máximo 40 caracteres.'
  return null
}

export async function loadAccessibleRosters(): Promise<RosterSummary[]> {
  const response = await client().from('rosters').select('id,name,owner_id').order('created_at')
  if (response.error) throw response.error
  return (response.data as { id: string; name: string; owner_id: string }[]).map((roster) => ({ id: roster.id, name: roster.name, ownerId: roster.owner_id }))
}

export async function createRoster(ownerId: string, name: string) {
  const response = await client().from('rosters').insert({ owner_id: ownerId, name: name.trim() }).select('id,name,owner_id').single()
  if (response.error) throw response.error
  const roster = response.data as { id: string; name: string; owner_id: string }
  return { id: roster.id, name: roster.name, ownerId: roster.owner_id } satisfies RosterSummary
}

export async function renameRoster(rosterId: string, name: string) {
  const response = await client().from('rosters').update({ name: name.trim() }).eq('id', rosterId).select('id,name,owner_id').single()
  if (response.error) throw response.error
  const roster = response.data as { id: string; name: string; owner_id: string }
  return { id: roster.id, name: roster.name, ownerId: roster.owner_id } satisfies RosterSummary
}

export async function loadActiveRosterId(userId: string) {
  const response = await client().from('roster_preferences').select('active_roster_id').eq('user_id', userId).maybeSingle()
  if (response.error) throw response.error
  return response.data?.active_roster_id as string | null | undefined
}

export async function saveActiveRosterId(userId: string, rosterId: string) {
  const response = await client().from('roster_preferences').upsert({ user_id: userId, active_roster_id: rosterId }, { onConflict: 'user_id' })
  if (response.error) throw response.error
}

export async function isRosterOwner(rosterId: string, userId: string) {
  const response = await client().from('rosters').select('id').eq('id', rosterId).eq('owner_id', userId).maybeSingle()
  if (response.error) throw response.error
  return Boolean(response.data)
}

export async function loadRosterRole(rosterId: string, userId: string): Promise<RosterRole | null> {
  if (await isRosterOwner(rosterId, userId)) return 'owner'
  const response = await client().from('roster_access').select('role').eq('roster_id', rosterId).eq('user_id', userId).maybeSingle()
  if (response.error) throw response.error
  return response.data?.role === 'technical' || response.data?.role === 'player' ? response.data.role : null
}

export async function loadRosterAccess(rosterId: string): Promise<RosterAccessEntry[]> {
  const response = await client().rpc('list_roster_access', { p_roster_id: rosterId })
  if (response.error) throw response.error
  return ((response.data ?? []) as Array<{ user_id: string; display_name: string; access_role: RosterAccessEntry['role'] }>).map((entry) => ({
    userId: entry.user_id,
    displayName: entry.display_name?.trim() || 'Sin nombre visible',
    role: entry.access_role,
  }))
}

export async function createRosterInvitation(rosterId: string, role: Exclude<RosterRole, 'owner'>) {
  const response = await client().rpc('create_roster_invitation', { p_roster_id: rosterId, p_role: role })
  if (response.error) throw response.error
  const row = (response.data as Array<{ token: string; expires_at: string }>)[0]
  if (!row) throw new Error('No se pudo crear la invitación.')
  return row
}

export async function updateRosterAccessRole(rosterId: string, userId: string, role: Exclude<RosterRole, 'owner'>) {
  const response = await client().rpc('update_roster_access_role', { p_roster_id: rosterId, p_user_id: userId, p_role: role })
  if (response.error) throw response.error
}

export async function removeRosterAccess(rosterId: string, userId: string) {
  const response = await client().rpc('remove_roster_access', { p_roster_id: rosterId, p_user_id: userId })
  if (response.error) throw response.error
}

export async function transferRosterOwnership(rosterId: string, userId: string) {
  const response = await client().rpc('transfer_roster_ownership', { p_roster_id: rosterId, p_new_owner_id: userId })
  if (response.error) throw response.error
}

export async function acceptRosterInvitation(token: string) {
  const response = await client().rpc('accept_roster_invitation', { p_token: token })
  if (response.error) throw response.error
  if (!response.data) throw new Error('No se pudo aceptar la invitación.')
  return response.data as string
}

export async function loadPlayers(rosterId: string) {
  const response = await client().from('players').select('id,name,base_rating,learned_rating,elo_seed,preferred_position,secondary_position,icon,color,archived_at').eq('roster_id', rosterId).order('archived_at', { ascending: true, nullsFirst: true }).order('name')
  if (response.error) throw response.error
  return (response.data as PlayerRow[]).map(fromRow)
}

export async function createPlayer(rosterId: string, player: Omit<Player, 'id' | 'archived'>) {
  const response = await client().from('players').insert({
    roster_id: rosterId,
    name: player.name.trim(),
    base_rating: player.baseRating,
    learned_rating: player.learnedRating,
    elo_seed: player.eloSeed,
    preferred_position: player.preferredPosition ?? null,
    secondary_position: player.secondaryPosition ?? null,
    icon: player.icon,
    color: player.color,
  }).select('id,name,base_rating,learned_rating,elo_seed,preferred_position,secondary_position,icon,color,archived_at').single()
  if (response.error) throw response.error
  return fromRow(response.data as PlayerRow)
}

export async function updatePlayer(playerId: string, player: Omit<Player, 'id' | 'archived'>) {
  const response = await client().from('players').update({
    name: player.name.trim(),
    base_rating: player.baseRating,
    learned_rating: player.learnedRating,
    elo_seed: player.eloSeed,
    preferred_position: player.preferredPosition ?? null,
    secondary_position: player.secondaryPosition ?? null,
    icon: player.icon,
    color: player.color,
  }).eq('id', playerId).select('id,name,base_rating,learned_rating,elo_seed,preferred_position,secondary_position,icon,color,archived_at').single()
  if (response.error) throw response.error
  return fromRow(response.data as PlayerRow)
}

export async function setArchived(playerId: string, archived: boolean) {
  const response = await client().from('players').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', playerId)
  if (response.error) throw response.error
}

export const toHistoryEntries = (rows: HistoryRow[]): HistoryEntry[] => rows.flatMap((match) => {
  const result = Array.isArray(match.match_results) ? match.match_results[0] : match.match_results
  const playerOffsets = (match.match_participants ?? []).flatMap((participant) => {
    const player = Array.isArray(participant.players) ? participant.players[0] : participant.players
    return player ? [{ playerId: player.id, playerName: player.name, offset: Number(participant.rating_offset), performanceRating: participant.performance_rating ?? 0, goals: participant.goals == null ? null : Number(participant.goals) }] : []
  })
  return result ? [{ id: match.id, createdAt: match.created_at, outcome: result.outcome, goalDifference: result.goal_difference, playerOffsets }] : []
})

export const toHistoryPage = (rows: HistoryRow[], pageSize: number): HistoryPage => {
  const entries = toHistoryEntries(rows)
  return { entries: entries.slice(0, pageSize), hasMore: entries.length > pageSize }
}

export const latestPlayerOffsets = (history: HistoryEntry[]) => {
  const offsets = new Map<string, number>()
  for (const entry of history) for (const player of entry.playerOffsets) {
    if (!offsets.has(player.playerId)) offsets.set(player.playerId, player.offset)
  }
  return offsets
}

export const playerGoalTotals = (rows: PlayerGoalRow[]) => {
  const totals = new Map<string, number>()
  for (const row of rows) if (row.goals != null) totals.set(row.player_id, (totals.get(row.player_id) ?? 0) + Number(row.goals))
  return totals
}

export const toChemistryHistory = (rows: ChemistryHistoryRow[]): ChemistryMatch[] => rows.flatMap((match) => {
  const result = Array.isArray(match.match_results) ? match.match_results[0] : match.match_results
  if (!result) return []
  const teams: [string[], string[]] = [[], []]
  for (const participant of match.match_participants ?? []) teams[participant.team - 1].push(participant.player_id)
  return [{ outcome: result.outcome, teams }]
})

export const toPlayerMatchHistoryEntries = (rows: PlayerHistoryRow[]): PlayerMatchHistoryEntry[] => rows.flatMap((participant) => {
  const match = Array.isArray(participant.matches) ? participant.matches[0] : participant.matches
  const matchResult = match && (Array.isArray(match.match_results) ? match.match_results[0] : match.match_results)
  if (!match || !matchResult) return []
  const result: PlayerMatchHistoryEntry['result'] = matchResult.outcome === 'draw' ? 'draw' : (matchResult.outcome === 'team_one') === (participant.team === 1) ? 'win' : 'loss'
  return [{ id: participant.match_id, createdAt: match.created_at, result, goalDifference: matchResult.goal_difference, offset: Number(participant.rating_offset), performanceRating: participant.performance_rating ?? 0, goals: participant.goals == null ? null : Number(participant.goals) }]
}).sort((one, two) => two.createdAt.localeCompare(one.createdAt) || two.id.localeCompare(one.id))

export async function loadHistory(rosterId: string, offset = 0, pageSize = 20): Promise<HistoryPage> {
  const response = await client().from('matches').select('id,created_at,match_results(outcome,goal_difference),match_participants(rating_offset,performance_rating,goals,players(id,name))').eq('roster_id', rosterId).eq('status', 'completed').order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + pageSize)
  if (response.error) throw response.error
  return toHistoryPage(response.data as unknown as HistoryRow[], pageSize)
}

export async function loadLatestPlayerOffsets(rosterId: string) {
  const response = await client().from('matches').select('id,created_at,match_results(outcome,goal_difference),match_participants(rating_offset,performance_rating,players(id,name))').eq('roster_id', rosterId).eq('status', 'completed').order('created_at', { ascending: false }).order('id', { ascending: false })
  if (response.error) throw response.error
  return latestPlayerOffsets(toHistoryEntries(response.data as unknown as HistoryRow[]))
}

export async function loadPlayerGoalTotals(rosterId: string) {
  const response = await client().from('match_participants').select('player_id,goals,matches!inner(roster_id,status)').eq('matches.roster_id', rosterId).eq('matches.status', 'completed')
  if (response.error) throw response.error
  return playerGoalTotals(response.data as PlayerGoalRow[])
}

export async function loadChemistryHistory(rosterId: string) {
  const response = await client().from('matches').select('match_results(outcome),match_participants(player_id,team)').eq('roster_id', rosterId).eq('status', 'completed')
  if (response.error) throw response.error
  return toChemistryHistory(response.data as ChemistryHistoryRow[])
}

export async function loadPlayerMatchHistory(rosterId: string, playerId: string) {
  const response = await client().from('match_participants').select('match_id,team,rating_offset,performance_rating,goals,matches!inner(created_at,roster_id,status,match_results(outcome,goal_difference))').eq('player_id', playerId).eq('matches.roster_id', rosterId).eq('matches.status', 'completed')
  if (response.error) throw response.error
  return toPlayerMatchHistoryEntries(response.data as unknown as PlayerHistoryRow[])
}

const participantRatings = (performanceRatings: ReadonlyMap<string, PerformanceRating>, goals: ReadonlyMap<string, number | null>) => [...performanceRatings.entries()].map(([player_id, performance_rating]) => ({ player_id, performance_rating, goals: goals.get(player_id) ?? null }))

export async function manageMatchHistory(matchId: string, action: 'edit' | 'delete', outcome?: HistoryEntry['outcome'], goalDifference?: number, performanceRatings: ReadonlyMap<string, PerformanceRating> = new Map(), goals: ReadonlyMap<string, number | null> = new Map()) {
  const response = action === 'edit'
    ? await client().rpc('manage_match_history_with_performance', {
      p_match_id: matchId,
      p_outcome: outcome ?? null,
      p_goal_difference: goalDifference ?? null,
      p_performance_ratings: participantRatings(performanceRatings, goals),
    })
    : await client().rpc('manage_match_history', {
    p_match_id: matchId,
    p_action: action,
    p_outcome: outcome ?? null,
    p_goal_difference: goalDifference ?? null,
  })
  if (response.error) throw response.error
}

export async function recordMatch(rosterId: string, teamOne: Team, teamTwo: Team, unassignedId: string | undefined, result: RecordedResult, goalDifference?: number, performanceRatings: ReadonlyMap<string, PerformanceRating> = new Map(), goals: ReadonlyMap<string, number | null> = new Map()) {
  const response = await client().rpc('record_match', {
    p_roster_id: rosterId,
    p_team_one: teamOne.players.map((player) => player.id),
    p_team_two: teamTwo.players.map((player) => player.id),
    p_unassigned_player_id: unassignedId ?? null,
    p_outcome: result === 'teamOne' ? 'team_one' : result === 'teamTwo' ? 'team_two' : 'draw',
    p_goal_difference: goalDifference ?? null,
    p_performance_ratings: participantRatings(performanceRatings, goals),
  })
  if (response.error) throw response.error
  return response.data as string
}
