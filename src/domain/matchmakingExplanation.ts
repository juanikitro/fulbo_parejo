import { isGoalkeeper, positionLine, type MatchProposal, type PositionLine } from './types'

export type MatchmakingExplanation = {
  summary: string
  criteria: string[]
}

const lineLabels: Record<Exclude<PositionLine, 'goalkeeper'>, string> = {
  defence: 'defensa',
  midfield: 'medio',
  attack: 'ataque',
}

const fmt = (value: number) => value.toFixed(2)

const lineSummary = (proposal: MatchProposal) => (Object.entries(lineLabels) as [Exclude<PositionLine, 'goalkeeper'>, string][])
  .flatMap(([line, label]) => {
    const one = proposal.teamOne.players.filter((player) => player.preferredPosition && positionLine[player.preferredPosition] === line).length
    const two = proposal.teamTwo.players.filter((player) => player.preferredPosition && positionLine[player.preferredPosition] === line).length
    return one + two ? [`${label} ${one}–${two}`] : []
  })

const goalkeeperMessage = (proposal: MatchProposal) => {
  const one = proposal.teamOne.players.filter((player) => isGoalkeeper(player.preferredPosition)).length
  const two = proposal.teamTwo.players.filter((player) => isGoalkeeper(player.preferredPosition)).length
  if (one === 1 && two === 1) return 'un arquero por lado'
  if (one + two === 1) return 'hay un solo arquero'
  if (one + two === 0) return 'sin arqueros convocados'
  return `arqueros repartidos: ${one} y ${two}`
}

export function describeMatchProposal(proposal: MatchProposal): MatchmakingExplanation {
  const lines = lineSummary(proposal)
  const summary = [`Δ ${fmt(proposal.balanceGap)} de media`, goalkeeperMessage(proposal)]
  const criteria = [
    `Las medias operativas terminaron con una diferencia de ${fmt(proposal.balanceGap)}.`,
    `Arqueros: ${goalkeeperMessage(proposal)}.`,
  ]

  if (lines.length) {
    summary.push(proposal.positionAdjustmentChangedResult ? 'posiciones contempladas como ajuste suave' : `líneas ${lines.join(' · ')}`)
    criteria.push(`Líneas registradas: ${lines.join(' · ')}.${proposal.positionAdjustmentChangedResult ? ' Cambiaron esta propuesta como ajuste suave.' : ''}`)
  }
  if (proposal.chemistryChangedResult) {
    summary.push('química considerada')
    criteria.push('La historia compartida de al menos 4 partidos cambió esta propuesta.')
  }
  if (proposal.unassigned) {
    summary.push(`${proposal.unassigned.name} sin asignar`)
    criteria.push(proposal.unassignedPreservesBalance
      ? `${proposal.unassigned.name} quedó sin asignar: fue la alternativa que mejor preservó el equilibrio.`
      : `${proposal.unassigned.name} quedó sin asignar al evaluar las alternativas de una convocatoria impar.`)
  }

  return { summary: summary.join(' · '), criteria }
}
