export const positions = ['PO', 'DFI', 'DFC', 'DFD', 'MC', 'MD', 'MI', 'DC', 'EI', 'ED'] as const
export type Position = (typeof positions)[number]
export type PositionLine = 'goalkeeper' | 'defence' | 'midfield' | 'attack'

export const positionLine: Record<Position, PositionLine> = {
  PO: 'goalkeeper',
  DFI: 'defence',
  DFC: 'defence',
  DFD: 'defence',
  MC: 'midfield',
  MD: 'midfield',
  MI: 'midfield',
  DC: 'attack',
  EI: 'attack',
  ED: 'attack',
}

export const isGoalkeeper = (position: Position | undefined) => position === 'PO'

export type Player = {
  id: string
  name: string
  baseRating: number
  learnedRating: number
  eloSeed: number
  preferredPosition?: Position
  secondaryPosition?: Position
  icon: string
  color: string
  archived?: boolean
}

export function partitionPlayers(players: Player[]) {
  return {
    activePlayers: players.filter((player) => !player.archived),
    archivedPlayers: players.filter((player) => player.archived),
  }
}

export type Team = {
  name: string
  players: Player[]
  operationalRating: number
}

export type MatchProposal = {
  teamOne: Team
  teamTwo: Team
  unassigned?: Player
  balanceGap: number
  goalkeeperCompensation: number
  positionPenalty: number
  positionAdjustmentChangedResult: boolean
  chemistryChangedResult: boolean
  unassignedPreservesBalance?: boolean
}

export const operationalRating = (player: Player) =>
  player.baseRating * 0.4 + player.learnedRating * 0.6
