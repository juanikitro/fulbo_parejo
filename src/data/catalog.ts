import type { Position } from '../domain/types'

export const playerIcons = ['⚽', '🥅', '🧤', '👟', '🏆', '🛡️', '🎯', '⚡', '🦁', '🐇', '🍺', '🧸', '🔪', '🧠', '👑', '⭐', '🐒', '💪', '🚬', '🏹', '🐙', '🏏', '🏳️‍🌈', '♿', '🐂', '🪄', '🚀', '🔥', '🚕', '💎']
export const playerColors = ['#ff6b35', '#2884ff', '#e0b400', '#a855f7', '#ec4899', '#14b8a6', '#ef4444', '#84cc16']

export const positionLabel: Record<Position, string> = {
  goalkeeper: 'Arquero',
  defender: 'Defensor',
  midfielder: 'Mediocampista',
  forward: 'Delantero',
}
