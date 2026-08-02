import type { User } from '@supabase/supabase-js'
import type { Player, Position, Team } from '../domain/types'
import type { PerformanceRating, RecordedResult } from '../domain/elo'
import { supabase } from './supabase'

type PlayerRow = {
  id: string
  name: string
  base_rating: number | string
  learned_rating: number | string
  elo_seed: number | string
  preferred_position: Position | null
  icon: string
  color: string
  archived_at: string | null
}

export type HistoryEntry = {
  id: string
  createdAt: string
  outcome: 'team_one' | 'team_two' | 'draw'
  goalDifference: number | null
  playerOffsets: { playerId: string; playerName: string; offset: number; performanceRating: PerformanceRating }[]
}
export type PlayerMatchHistoryEntry = {
  id: string
  createdAt: string
  result: 'win' | 'loss' | 'draw'
  goalDifference: number | null
  offset: number
  performanceRating: PerformanceRating
}
type HistoryResult = { outcome: HistoryEntry['outcome']; goal_difference: number | null }
type HistoryParticipant = { rating_offset: number | string; performance_rating: PerformanceRating; players: { id: string; name: string } | { id: string; name: string }[] | null }
type HistoryRow = { id: string; created_at: string; match_results: HistoryResult | HistoryResult[] | null; match_participants: HistoryParticipant[] | null }
type PlayerHistoryRow = { match_id: string; team: 1 | 2; rating_offset: number | string; performance_rating: PerformanceRating; matches: { created_at: string; match_results: HistoryResult | HistoryResult[] | null } | { created_at: string; match_results: HistoryResult | HistoryResult[] | null }[] | null }

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
  icon: row.icon,
  color: row.color,
  archived: Boolean(row.archived_at),
})

export async function ensureRoster(user: User) {
  const db = client()
  const membership = await db.from('roster_members').select('roster_id').eq('user_id', user.id).limit(1).maybeSingle()
  if (membership.error) throw membership.error
  if (membership.data) return membership.data.roster_id as string
  const existing = await db.from('rosters').select('id').eq('owner_id', user.id).maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data) return existing.data.id as string
  const created = await db.from('rosters').insert({ owner_id: user.id, name: 'Mi plantel' }).select('id').single()
  if (created.error) throw created.error
  return created.data.id as string
}

export async function isRosterOwner(rosterId: string, userId: string) {
  const response = await client().from('rosters').select('id').eq('id', rosterId).eq('owner_id', userId).maybeSingle()
  if (response.error) throw response.error
  return Boolean(response.data)
}

export async function createRosterInvitation(rosterId: string) {
  const response = await client().rpc('create_roster_invitation', { p_roster_id: rosterId })
  if (response.error) throw response.error
  const row = (response.data as Array<{ token: string; expires_at: string }>)[0]
  if (!row) throw new Error('No se pudo crear la invitación.')
  return row
}

export async function acceptRosterInvitation(token: string) {
  const response = await client().rpc('accept_roster_invitation', { p_token: token })
  if (response.error) throw response.error
  if (!response.data) throw new Error('No se pudo aceptar la invitación.')
  return response.data as string
}

export async function loadPlayers(rosterId: string) {
  const response = await client().from('players').select('id,name,base_rating,learned_rating,elo_seed,preferred_position,icon,color,archived_at').eq('roster_id', rosterId).order('archived_at', { ascending: true, nullsFirst: true }).order('name')
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
    icon: player.icon,
    color: player.color,
  }).select('id,name,base_rating,learned_rating,elo_seed,preferred_position,icon,color,archived_at').single()
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
    icon: player.icon,
    color: player.color,
  }).eq('id', playerId).select('id,name,base_rating,learned_rating,elo_seed,preferred_position,icon,color,archived_at').single()
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
    return player ? [{ playerId: player.id, playerName: player.name, offset: Number(participant.rating_offset), performanceRating: participant.performance_rating ?? 0 }] : []
  })
  return result ? [{ id: match.id, createdAt: match.created_at, outcome: result.outcome, goalDifference: result.goal_difference, playerOffsets }] : []
})

export const latestPlayerOffsets = (history: HistoryEntry[]) => {
  const offsets = new Map<string, number>()
  for (const entry of history) for (const player of entry.playerOffsets) {
    if (!offsets.has(player.playerId)) offsets.set(player.playerId, player.offset)
  }
  return offsets
}

export const toPlayerMatchHistoryEntries = (rows: PlayerHistoryRow[]): PlayerMatchHistoryEntry[] => rows.flatMap((participant) => {
  const match = Array.isArray(participant.matches) ? participant.matches[0] : participant.matches
  const matchResult = match && (Array.isArray(match.match_results) ? match.match_results[0] : match.match_results)
  if (!match || !matchResult) return []
  const result: PlayerMatchHistoryEntry['result'] = matchResult.outcome === 'draw' ? 'draw' : (matchResult.outcome === 'team_one') === (participant.team === 1) ? 'win' : 'loss'
  return [{ id: participant.match_id, createdAt: match.created_at, result, goalDifference: matchResult.goal_difference, offset: Number(participant.rating_offset), performanceRating: participant.performance_rating ?? 0 }]
}).sort((one, two) => two.createdAt.localeCompare(one.createdAt) || two.id.localeCompare(one.id))

export async function loadHistory(rosterId: string) {
  const response = await client().from('matches').select('id,created_at,match_results(outcome,goal_difference),match_participants(rating_offset,performance_rating,players(id,name))').eq('roster_id', rosterId).eq('status', 'completed').order('created_at', { ascending: false }).limit(20)
  if (response.error) throw response.error
  return toHistoryEntries(response.data as unknown as HistoryRow[])
}

export async function loadLatestPlayerOffsets(rosterId: string) {
  const response = await client().from('matches').select('id,created_at,match_results(outcome,goal_difference),match_participants(rating_offset,performance_rating,players(id,name))').eq('roster_id', rosterId).eq('status', 'completed').order('created_at', { ascending: false }).order('id', { ascending: false })
  if (response.error) throw response.error
  return latestPlayerOffsets(toHistoryEntries(response.data as unknown as HistoryRow[]))
}

export async function loadPlayerMatchHistory(rosterId: string, playerId: string) {
  const response = await client().from('match_participants').select('match_id,team,rating_offset,performance_rating,matches!inner(created_at,roster_id,status,match_results(outcome,goal_difference))').eq('player_id', playerId).eq('matches.roster_id', rosterId).eq('matches.status', 'completed')
  if (response.error) throw response.error
  return toPlayerMatchHistoryEntries(response.data as unknown as PlayerHistoryRow[])
}

export async function manageMatchHistory(matchId: string, action: 'edit' | 'delete', outcome?: HistoryEntry['outcome'], goalDifference?: number, performanceRatings?: ReadonlyMap<string, PerformanceRating>) {
  const response = action === 'edit'
    ? await client().rpc('manage_match_history_with_performance', {
      p_match_id: matchId,
      p_outcome: outcome ?? null,
      p_goal_difference: goalDifference ?? null,
      p_performance_ratings: [...(performanceRatings ?? new Map<string, PerformanceRating>()).entries()].map(([player_id, performance_rating]) => ({ player_id, performance_rating })),
    })
    : await client().rpc('manage_match_history', {
    p_match_id: matchId,
    p_action: action,
    p_outcome: outcome ?? null,
    p_goal_difference: goalDifference ?? null,
  })
  if (response.error) throw response.error
}

export async function recordMatch(rosterId: string, teamOne: Team, teamTwo: Team, unassignedId: string | undefined, result: RecordedResult, updates: Map<string, number>, goalDifference?: number, performanceRatings: ReadonlyMap<string, PerformanceRating> = new Map()) {
  const db = client()
  const match = await db.from('matches').insert({ roster_id: rosterId, team_size: teamOne.players.length, unassigned_player_id: unassignedId ?? null, status: 'completed' }).select('id').single()
  if (match.error) throw match.error
  const matchId = match.data.id as string
  const participants = [...teamOne.players.map((player, ordinal) => ({ match_id: matchId, player_id: player.id, team: 1, ordinal, rating_offset: updates.get(player.id)! - player.learnedRating, performance_rating: performanceRatings.get(player.id) ?? 0 })), ...teamTwo.players.map((player, ordinal) => ({ match_id: matchId, player_id: player.id, team: 2, ordinal, rating_offset: updates.get(player.id)! - player.learnedRating, performance_rating: performanceRatings.get(player.id) ?? 0 }))]
  const participantResult = await db.from('match_participants').insert(participants)
  if (participantResult.error) throw participantResult.error
  const resultRow = await db.from('match_results').insert({ match_id: matchId, outcome: result === 'teamOne' ? 'team_one' : result === 'teamTwo' ? 'team_two' : 'draw', goal_difference: goalDifference ?? null })
  if (resultRow.error) throw resultRow.error
  const ratingWrites = [...updates.entries()].map(([id, learned_rating]) => db.from('players').update({ learned_rating }).eq('id', id))
  const settled = await Promise.all(ratingWrites)
  const failed = settled.find((entry) => entry.error)
  if (failed?.error) throw failed.error
}
