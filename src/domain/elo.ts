import { operationalRating, type Player } from './types'

export type RecordedResult = 'teamOne' | 'teamTwo' | 'draw'
export type PerformanceRating = -2 | -1 | 0 | 1 | 2

export const performanceLevels: { value: PerformanceRating; label: string }[] = [
  { value: -2, label: 'Muy mal' },
  { value: -1, label: 'Mal' },
  { value: 0, label: 'Normal' },
  { value: 1, label: 'Bien' },
  { value: 2, label: 'Muy bien' },
]

const EXPECTATION_SCALE = 2.5
const BASE_K = 0.24

export const expectedScore = (teamOne: Player[], teamTwo: Player[]) => {
  const one = teamOne.reduce((sum, player) => sum + operationalRating(player), 0) / teamOne.length
  const two = teamTwo.reduce((sum, player) => sum + operationalRating(player), 0) / teamTwo.length
  return 1 / (1 + 10 ** ((two - one) / EXPECTATION_SCALE))
}

const adjustedDelta = (delta: number, performance: PerformanceRating) => delta * (1 + Math.sign(delta) * performance * 0.25)

export function applyEloResult(teamOne: Player[], teamTwo: Player[], result: RecordedResult, goalDifference?: number, performanceRatings: ReadonlyMap<string, PerformanceRating> = new Map()) {
  const expectedOne = expectedScore(teamOne, teamTwo)
  const observedOne = result === 'teamOne' ? 1 : result === 'teamTwo' ? 0 : 0.5
  const multiplier = goalDifference && goalDifference > 0 ? Math.min(1.5, 1 + Math.log2(goalDifference) * 0.15) : 1
  const delta = BASE_K * multiplier * (observedOne - expectedOne)
  const updates = new Map<string, number>()
  for (const player of teamOne) updates.set(player.id, player.learnedRating + adjustedDelta(delta, performanceRatings.get(player.id) ?? 0))
  for (const player of teamTwo) updates.set(player.id, player.learnedRating + adjustedDelta(-delta, performanceRatings.get(player.id) ?? 0))
  return updates
}
