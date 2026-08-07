import { isGoalkeeper, operationalRating, positionLine, positions, type MatchProposal, type Player, type Team } from './types'
import { pairChemistry, type PairChemistry } from './chemistry'

const GOALKEEPER_COMPENSATION = 0.4
const LINE_POSITION_PENALTY = 0.16
const EXACT_POSITION_PENALTY = 0.08
const SECONDARY_POSITION_WEIGHT = 0.5
const CHEMISTRY_WEIGHT = 0.08

const total = (players: Player[]) => players.reduce((sum, player) => sum + operationalRating(player), 0)
const coversGoalkeeper = (player: Player) => isGoalkeeper(player.preferredPosition) || isGoalkeeper(player.secondaryPosition)
const goalkeeperPriority = (player: Player) => isGoalkeeper(player.preferredPosition) ? 2 : isGoalkeeper(player.secondaryPosition) ? 1 : 0
const positionCoverage = (player: Player, position: typeof positions[number]) => player.preferredPosition === position ? 1 : player.secondaryPosition === position ? SECONDARY_POSITION_WEIGHT : 0
const lineCoverage = (player: Player, line: 'defence' | 'midfield' | 'attack') => player.preferredPosition && positionLine[player.preferredPosition] === line ? 1 : player.secondaryPosition && positionLine[player.secondaryPosition] === line ? SECONDARY_POSITION_WEIGHT : 0

const positionPenalty = (one: Player[], two: Player[]) => {
  const linePenalty = ['defence', 'midfield', 'attack'] as const
  const byLine = linePenalty.reduce((penalty, line) => {
    const oneCount = one.reduce((count, player) => count + lineCoverage(player, line), 0)
    const twoCount = two.reduce((count, player) => count + lineCoverage(player, line), 0)
    return penalty + Math.abs(oneCount - twoCount) * LINE_POSITION_PENALTY
  }, 0)
  const byPosition = positions.filter((position) => !isGoalkeeper(position)).reduce((penalty, position) => {
    const oneCount = one.reduce((count, player) => count + positionCoverage(player, position), 0)
    const twoCount = two.reduce((count, player) => count + positionCoverage(player, position), 0)
    return penalty + Math.abs(oneCount - twoCount) * EXACT_POSITION_PENALTY
  }, 0)
  return byLine + byPosition
}

const adjustedStrength = (players: Player[]) =>
  total(players) - (players.some(coversGoalkeeper) ? 0 : GOALKEEPER_COMPENSATION)

const teamChemistry = (players: Player[], chemistry: PairChemistry) => players.reduce((score, player, index) => score + players.slice(index + 1).reduce((pairScore, teammate) => pairScore + pairChemistry(chemistry, player.id, teammate.id), 0), 0)

const score = (one: Player[], two: Player[], requireGoalkeeperEach: boolean, chemistry: PairChemistry, includePositionPenalty: boolean) => {
  const missingGoalkeeper = [one, two].filter((team) => !team.some(coversGoalkeeper)).length
  const goalkeeperPenalty = requireGoalkeeperEach ? missingGoalkeeper * 100 : 0
  return Math.abs(adjustedStrength(one) - adjustedStrength(two)) + (includePositionPenalty ? positionPenalty(one, two) : 0) + goalkeeperPenalty - (teamChemistry(one, chemistry) + teamChemistry(two, chemistry)) * CHEMISTRY_WEIGHT
}

const splitEven = (players: Player[], chemistry: PairChemistry, includePositionPenalty: boolean) => {
  const targetSize = players.length / 2
  const remaining = [...players].sort((a, b) => operationalRating(b) - operationalRating(a))
  const one: Player[] = []
  const two: Player[] = []
  const goalkeepers = remaining.filter(coversGoalkeeper).sort((one, two) => goalkeeperPriority(two) - goalkeeperPriority(one) || operationalRating(two) - operationalRating(one))
  const requireGoalkeeperEach = goalkeepers.length >= 2

  if (goalkeepers.length >= 2) {
    one.push(goalkeepers[0])
    two.push(goalkeepers[1])
    remaining.splice(remaining.indexOf(goalkeepers[0]), 1)
    remaining.splice(remaining.indexOf(goalkeepers[1]), 1)
  } else if (goalkeepers.length === 1) {
    one.push(goalkeepers[0])
    remaining.splice(remaining.indexOf(goalkeepers[0]), 1)
  }

  for (const player of remaining) {
    if (one.length === targetSize) two.push(player)
    else if (two.length === targetSize) one.push(player)
    else if (adjustedStrength(one) <= adjustedStrength(two)) one.push(player)
    else two.push(player)
  }

  let improved = true
  while (improved) {
    improved = false
    const current = score(one, two, requireGoalkeeperEach, chemistry, includePositionPenalty)
    let best = current
    let swap: [number, number] | undefined
    for (let first = 0; first < one.length; first += 1) {
      for (let second = 0; second < two.length; second += 1) {
        const firstTeam = [...one]
        const secondTeam = [...two]
        ;[firstTeam[first], secondTeam[second]] = [secondTeam[second], firstTeam[first]]
        const candidate = score(firstTeam, secondTeam, requireGoalkeeperEach, chemistry, includePositionPenalty)
        if (candidate < best - 0.000001) {
          best = candidate
          swap = [first, second]
        }
      }
    }
    if (swap) {
      ;[one[swap[0]], two[swap[1]]] = [two[swap[1]], one[swap[0]]]
      improved = true
    }
  }
  return { one, two }
}

const asTeam = (name: string, players: Player[]): Team => ({ name, players, operationalRating: total(players) })

type ProposalCore = Omit<MatchProposal, 'positionAdjustmentChangedResult' | 'chemistryChangedResult'>

const arrangementSignature = (proposal: Pick<MatchProposal, 'teamOne' | 'teamTwo' | 'unassigned'>) => [
  ...[proposal.teamOne, proposal.teamTwo].map((team) => team.players.map((player) => player.id).sort().join(',')).sort(),
  proposal.unassigned?.id ?? '',
].join('|')

const sameArrangement = (one: Pick<MatchProposal, 'teamOne' | 'teamTwo' | 'unassigned'>, two: Pick<MatchProposal, 'teamOne' | 'teamTwo' | 'unassigned'>) => arrangementSignature(one) === arrangementSignature(two)

function buildProposal(players: Player[], chemistry: PairChemistry, includePositionPenalty: boolean): ProposalCore {
  const candidates = players.length % 2 === 0 ? [{ selected: players, unassigned: undefined }] : players.map((unassigned) => ({ selected: players.filter((player) => player.id !== unassigned.id), unassigned }))
  let best: { one: Player[]; two: Player[]; unassigned?: Player; score: number; balanceGap: number } | undefined
  const candidateBalanceGaps: number[] = []

  for (const candidate of candidates) {
    const split = splitEven(candidate.selected, chemistry, includePositionPenalty)
    const candidateScore = score(split.one, split.two, candidate.selected.filter(coversGoalkeeper).length >= 2, chemistry, includePositionPenalty)
    const balanceGap = Math.abs(total(split.one) - total(split.two))
    candidateBalanceGaps.push(balanceGap)
    if (!best || candidateScore < best.score) best = { ...split, unassigned: candidate.unassigned, score: candidateScore, balanceGap }
  }

  if (!best) throw new Error('No se pudo generar un armado.')
  const teamOne = asTeam('Equipo Claro', best.one)
  const teamTwo = asTeam('Equipo Oscuro', best.two)
  return {
    teamOne,
    teamTwo,
    unassigned: best.unassigned,
    balanceGap: Math.abs(teamOne.operationalRating - teamTwo.operationalRating),
    goalkeeperCompensation: GOALKEEPER_COMPENSATION,
    positionPenalty: positionPenalty(best.one, best.two),
    unassignedPreservesBalance: best.unassigned ? best.balanceGap <= Math.min(...candidateBalanceGaps) + 0.000001 : undefined,
  }
}

export function findComparableSwap(player: Player, teammates: Player[], opponents: Player[]) {
  const playerRating = operationalRating(player)
  const teammateTotal = total(teammates)
  const opponentTotal = total(opponents)

  return [...opponents]
    .filter((candidate) => isGoalkeeper(candidate.preferredPosition) === isGoalkeeper(player.preferredPosition))
    .sort((one, two) => {
      const balanceGap = (candidate: Player) => Math.abs(
        (teammateTotal - playerRating + operationalRating(candidate)) / teammates.length
        - (opponentTotal - operationalRating(candidate) + playerRating) / opponents.length,
      )
      const gapDifference = balanceGap(one) - balanceGap(two)
      if (Math.abs(gapDifference) > 0.000001) return gapDifference

      const positionCompatibility = (candidate: Player) => candidate.preferredPosition === player.preferredPosition ? 4 : candidate.secondaryPosition === player.preferredPosition || candidate.preferredPosition === player.secondaryPosition ? 2 : candidate.secondaryPosition === player.secondaryPosition ? 1 : 0
      const compatibilityDifference = positionCompatibility(two) - positionCompatibility(one)
      if (compatibilityDifference) return compatibilityDifference

      return Math.abs(operationalRating(one) - playerRating) - Math.abs(operationalRating(two) - playerRating)
    })[0]
}

export function createMatchProposal(players: Player[], chemistry: PairChemistry = new Map(), chemistryWithSufficientEvidence: PairChemistry = new Map()): MatchProposal {
  const active = players.filter((player) => !player.archived)
  if (active.length < 2) throw new Error('Se necesitan al menos dos convocados para armar equipos.')

  const proposal = buildProposal(active, chemistry, true)
  const withoutPositions = buildProposal(active, chemistry, false)
  const withoutChemistry = buildProposal(active, new Map(), true)
  const withSufficientChemistry = buildProposal(active, chemistryWithSufficientEvidence, true)
  return {
    ...proposal,
    positionAdjustmentChangedResult: !sameArrangement(proposal, withoutPositions),
    chemistryChangedResult: !sameArrangement(withoutChemistry, withSufficientChemistry) && sameArrangement(proposal, withSufficientChemistry),
  }
}
