export const positions = ['goalkeeper', 'defender', 'midfielder', 'forward'] as const
export type Position = (typeof positions)[number]

export type Player = {
  id: string
  name: string
  baseRating: number
  learnedRating: number
  eloSeed: number
  preferredPosition?: Position
  icon: string
  color: string
  archived?: boolean
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
}

export const operationalRating = (player: Player) =>
  player.baseRating * 0.4 + player.learnedRating * 0.6
