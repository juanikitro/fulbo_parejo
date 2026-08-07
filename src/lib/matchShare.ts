type ShareTeam = {
  name: string
  players: Array<{ name: string }>
}

export function formatShareMovement(offset: number | undefined) {
  if (!offset) return null
  const positive = offset > 0
  return { text: `${positive ? '↑ +' : '↓ -'}${Math.abs(offset).toFixed(2)}`, color: positive ? '#9fdf76' : '#ff9c8e' }
}

export function formatMatchShareText(teamOne: ShareTeam, teamTwo: ShareTeam) {
  return `${teamOne.name}\n${teamOne.players.map((player) => `• ${player.name}`).join('\n')}\n\nVS\n\n${teamTwo.name}\n${teamTwo.players.map((player) => `• ${player.name}`).join('\n')}`
}
