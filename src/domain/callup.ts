import { positionLine, type Player, type PositionLine } from './types'

type CallupPositionGroup = { label: string; line?: PositionLine }

const callupPositionGroups: CallupPositionGroup[] = [
  { label: 'Porteros', line: 'goalkeeper' },
  { label: 'Defensores', line: 'defence' },
  { label: 'Mediocampistas', line: 'midfield' },
  { label: 'Delanteros', line: 'attack' },
  { label: 'Sin posición' },
]

export function groupCallupPlayers(players: Player[]) {
  return callupPositionGroups.map((group) => ({
    ...group,
    players: players.filter((player) => group.line ? player.preferredPosition && positionLine[player.preferredPosition] === group.line : !player.preferredPosition),
  })).filter((group) => group.players.length)
}
