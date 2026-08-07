import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { HistoryEntry } from '../lib/repository'
import type { Player } from '../domain/types'
import HistoryTab from './HistoryTab'
import SquadTab from './SquadTab'

const player: Player = { id: 'player-1', name: 'Mica', baseRating: 60, learnedRating: 60, eloSeed: 60, icon: '⚽', color: '#ffffff', archived: false }
const history: HistoryEntry[] = [{ id: 'match-1', createdAt: '2026-08-07T00:00:00.000Z', outcome: 'draw', goalDifference: null, playerOffsets: [] }]

describe('member permissions', () => {
  it('does not render roster or history write actions for an invited player', () => {
    const squad = renderToStaticMarkup(createElement(SquadTab, { editable: false, activePlayers: [player], archivedPlayers: [], latestOffsets: new Map(), onCreatePlayer: () => undefined, onOpenPlayerDetail: () => undefined, onEditPlayer: () => undefined, onArchivePlayer: () => undefined, onRestorePlayer: () => undefined, archivingPlayerId: null, onExport: () => undefined }))
    const historyMarkup = renderToStaticMarkup(createElement(HistoryTab, { editable: false, history, saving: false, hasMore: false, loadingMore: false, onEdit: () => undefined, onDelete: () => undefined, onLoadMore: () => undefined }))
    expect(squad).not.toContain('Crear jugador')
    expect(squad).not.toContain('Editar Mica')
    expect(squad).not.toContain('Archivar a Mica')
    expect(historyMarkup).not.toContain('history-actions')
  })
})
