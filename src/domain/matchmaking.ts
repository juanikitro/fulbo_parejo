import { isGoalkeeper, operationalRating, positionLine, positions, type MatchProposal, type Player, type Team } from './types'
import { pairChemistry, type PairChemistry } from './chemistry'

const GOALKEEPER_COMPENSATION = 0.4
const LINE_POSITION_PENALTY = 0.16
const EXACT_POSITION_PENALTY = 0.08
const CHEMISTRY_WEIGHT = 0.08

const total = (players: Player[]) => players.reduce((sum, player) => sum + operationalRating(player), 0)

const positionPenalty = (one: Player[], two: Player[]) => {
  const linePenalty = ['defence', 'midfield', 'attack'] as const
  const byLine = linePenalty.reduce((penalty, line) => {
    const oneCount = one.filter((player) => player.preferredPosition && positionLine[player.preferredPosition] === line).length
    const twoCount = two.filter((player) => player.preferredPosition && positionLine[player.preferredPosition] === line).length
    return penalty + Math.abs(oneCount - twoCount) * LINE_POSITION_PENALTY
  }, 0)
  const byPosition = positions.filter((position) => !isGoalkeeper(position)).reduce((penalty, position) => {
    const oneCount = one.filter((player) => player.preferredPosition === position).length
    const twoCount = two.filter((player) => player.preferredPosition === position).length
    return penalty + Math.abs(oneCount - twoCount) * EXACT_POSITION_PENALTY
  }, 0)
  return byLine + byPosition
}

const adjustedStrength = (players: Player[]) =>
  total(players) - (players.some((player) => isGoalkeeper(player.preferredPosition)) ? 0 : GOALKEEPER_COMPENSATION)

const teamChemistry = (players: Player[], chemistry: PairChemistry) => players.reduce((score, player, index) => score + players.slice(index + 1).reduce((pairScore, teammate) => pairScore + pairChemistry(chemistry, player.id, teammate.id), 0), 0)

const score = (one: Player[], two: Player[], requireGoalkeeperEach: boolean, chemistry: PairChemistry) => {
  const missingGoalkeeper = [one, two].filter((team) => !team.some((player) => isGoalkeeper(player.preferredPosition))).length
  const goalkeeperPenalty = requireGoalkeeperEach ? missingGoalkeeper * 100 : 0
  return Math.abs(adjustedStrength(one) - adjustedStrength(two)) + positionPenalty(one, two) + goalkeeperPenalty - (teamChemistry(one, chemistry) + teamChemistry(two, chemistry)) * CHEMISTRY_WEIGHT
}

const splitEven = (players: Player[], chemistry: PairChemistry) => {
  const targetSize = players.length / 2
  const remaining = [...players].sort((a, b) => operationalRating(b) - operationalRating(a))
  const one: Player[] = []
  const two: Player[] = []
  const goalkeepers = remaining.filter((player) => isGoalkeeper(player.preferredPosition))
  const requireGoalkeeperEach = goalkeepers.length >= 2

  if (goalkeepers.length >= 2) {
    one.push(goalkeepers[0])
    two.push(goalkeepers[1])
    for (const goalkeeper of goalkeepers.slice(2)) remaining.splice(remaining.indexOf(goalkeeper), 1)
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
    const current = score(one, two, requireGoalkeeperEach, chemistry)
    let best = current
    let swap: [number, number] | undefined
    for (let first = 0; first < one.length; first += 1) {
      for (let second = 0; second < two.length; second += 1) {
        const firstTeam = [...one]
        const secondTeam = [...two]
        ;[firstTeam[first], secondTeam[second]] = [secondTeam[second], firstTeam[first]]
        const candidate = score(firstTeam, secondTeam, requireGoalkeeperEach, chemistry)
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

export function findComparableSwap(player: Player, opponents: Player[]) {
  const samePosition = opponents.filter((candidate) => candidate.preferredPosition === player.preferredPosition)
  const sameLine = player.preferredPosition && !isGoalkeeper(player.preferredPosition)
    ? opponents.filter((candidate) => candidate.preferredPosition && positionLine[candidate.preferredPosition] === positionLine[player.preferredPosition!])
    : []
  const sameGoalkeeperStatus = opponents.filter((candidate) => isGoalkeeper(candidate.preferredPosition) === isGoalkeeper(player.preferredPosition))
  const compatible = samePosition.length ? samePosition : sameLine.length ? sameLine : sameGoalkeeperStatus
  const candidate = [...compatible].sort((one, two) => Math.abs(operationalRating(one) - operationalRating(player)) - Math.abs(operationalRating(two) - operationalRating(player)))[0]
  return candidate && Math.abs(operationalRating(candidate) - operationalRating(player)) <= 1.5 ? candidate : undefined
}

export function createMatchProposal(players: Player[], chemistry: PairChemistry = new Map()): MatchProposal {
  const active = players.filter((player) => !player.archived)
  if (active.length < 2) throw new Error('Se necesitan al menos dos convocados para armar equipos.')

  const candidates = active.length % 2 === 0 ? [{ selected: active, unassigned: undefined }] : active.map((unassigned) => ({ selected: active.filter((player) => player.id !== unassigned.id), unassigned }))
  let best: { one: Player[]; two: Player[]; unassigned?: Player; score: number } | undefined

  for (const candidate of candidates) {
    const split = splitEven(candidate.selected, chemistry)
    const candidateScore = score(split.one, split.two, candidate.selected.filter((player) => isGoalkeeper(player.preferredPosition)).length >= 2, chemistry)
    if (!best || candidateScore < best.score) best = { ...split, unassigned: candidate.unassigned, score: candidateScore }
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
  }
}
