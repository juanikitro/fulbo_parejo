type ShareTeam = {
  name: string
  players: Array<{ name: string }>
}

export function formatMatchShareText(teamOne: ShareTeam, teamTwo: ShareTeam) {
  return `${teamOne.name}\n${teamOne.players.map((player) => `• ${player.name}`).join('\n')}\n\nVS\n\n${teamTwo.name}\n${teamTwo.players.map((player) => `• ${player.name}`).join('\n')}`
}
