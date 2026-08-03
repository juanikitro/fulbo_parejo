export type ChemistryOutcome = 'team_one' | 'team_two' | 'draw'

export type ChemistryMatch = {
  outcome: ChemistryOutcome
  teams: readonly [readonly string[], readonly string[]]
}

export type PairChemistry = ReadonlyMap<string, number>

export type ChemistryPair = {
  playerIds: readonly [string, string]
  score: number
  matches: number
}

export function chemistryExtremes<T extends ChemistryPair>(pairs: readonly T[], limit = 3) {
  const strongest = [...pairs].sort((first, second) => second.score - first.score).slice(0, limit)
  const strongestPairs = new Set(strongest)
  const weakest = pairs.filter((pair) => !strongestPairs.has(pair)).sort((first, second) => first.score - second.score).slice(0, limit)
  return { strongest, weakest }
}

const CONFIDENCE_MATCHES = 4

const keyForPair = (first: string, second: string) => first < second ? `${first}\u0000${second}` : `${second}\u0000${first}`

const outcomeValue = (outcome: ChemistryOutcome, team: 1 | 2) => outcome === 'draw' ? 0.25 : (outcome === 'team_one') === (team === 1) ? 1 : -1

export const pairChemistry = (chemistry: PairChemistry, first: string, second: string) => chemistry.get(keyForPair(first, second)) ?? 0

export function chemistryPairsFromHistory(matches: readonly ChemistryMatch[]): ChemistryPair[] {
  const totals = new Map<string, { points: number; matches: number }>()

  for (const match of matches) {
    match.teams.forEach((team, index) => {
      const value = outcomeValue(match.outcome, index === 0 ? 1 : 2)
      for (let first = 0; first < team.length; first += 1) {
        for (let second = first + 1; second < team.length; second += 1) {
          const key = keyForPair(team[first], team[second])
          const current = totals.get(key) ?? { points: 0, matches: 0 }
          totals.set(key, { points: current.points + value, matches: current.matches + 1 })
        }
      }
    })
  }

  return [...totals].map(([key, total]) => ({
    playerIds: key.split('\u0000') as [string, string],
    score: total.points / total.matches * Math.min(1, total.matches / CONFIDENCE_MATCHES),
    matches: total.matches,
  }))
}

export function chemistryFromHistory(matches: readonly ChemistryMatch[]): PairChemistry {
  return new Map(chemistryPairsFromHistory(matches).map((pair) => [keyForPair(...pair.playerIds), pair.score]))
}

export function chemistryWithSufficientEvidence(matches: readonly ChemistryMatch[]): PairChemistry {
  const totals = new Map<string, { points: number; matches: number }>()

  for (const match of matches) {
    match.teams.forEach((team, index) => {
      const value = outcomeValue(match.outcome, index === 0 ? 1 : 2)
      for (let first = 0; first < team.length; first += 1) {
        for (let second = first + 1; second < team.length; second += 1) {
          const key = keyForPair(team[first], team[second])
          const current = totals.get(key) ?? { points: 0, matches: 0 }
          totals.set(key, { points: current.points + value, matches: current.matches + 1 })
        }
      }
    })
  }

  return new Map([...totals]
    .filter(([, total]) => total.matches >= CONFIDENCE_MATCHES)
    .map(([key, total]) => [key, total.points / total.matches]))
}
