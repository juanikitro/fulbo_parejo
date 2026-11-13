import { positionLabel } from '../data/catalog'
import { operationalRating, type Player } from '../domain/types'

type SquadTabProps = {
  activePlayers: Player[]
  players: Player[]
  latestOffsets: ReadonlyMap<string, number>
  onCreatePlayer: () => void
  onOpenPlayerDetail: (player: Player) => void | Promise<void>
  onEditPlayer: (player: Player) => void
  onArchivePlayer: (player: Player) => void | Promise<void>
  onExport: () => void
}

function OffsetIndicator({ offset }: { offset: number | undefined }) {
  if (!offset) return null
  const positive = offset > 0
  return <small className={`rating-offset ${positive ? 'positive-offset' : 'negative-offset'}`} aria-label={`${positive ? 'Subió' : 'Bajó'} ${Math.abs(offset).toFixed(2)} puntos`}>{positive ? '↑' : '↓'} {positive ? '+' : ''}{offset.toFixed(2)}</small>
}

export default function SquadTab({ activePlayers, players, latestOffsets, onCreatePlayer, onOpenPlayerDetail, onEditPlayer, onArchivePlayer, onExport }: SquadTabProps) {
  const playersByRating = [...activePlayers].sort((a, b) =>
    operationalRating(b) - operationalRating(a) || a.name.localeCompare(b.name, 'es-AR'),
  )

  return <section className="panel"><div className="panel-heading"><div><p className="eyebrow">TU PLANTEL</p><h2>{activePlayers.length} jugadores activos</h2></div><button onClick={onCreatePlayer}>+ Crear jugador</button></div><div className="squad-grid">{playersByRating.map((player) => <article className="player-card" key={player.id}><button type="button" className="player-detail-trigger" aria-label={`Ver ficha de ${player.name}`} onClick={() => void onOpenPlayerDetail(player)}><span className="player-icon" style={{ backgroundColor: player.color }}>{player.icon}</span><span><strong>{player.name}</strong><small>{player.preferredPosition ? `${player.preferredPosition} · ${positionLabel[player.preferredPosition]}` : 'Sin posición'}</small></span></button><b>{player.baseRating} <small>({player.learnedRating.toFixed(2)})</small></b><OffsetIndicator offset={latestOffsets.get(player.id)} /><div className="player-actions"><button aria-label={`Editar ${player.name}`} onClick={() => onEditPlayer(player)}>✏️</button><button aria-label={`Archivar ${player.name}`} onClick={() => void onArchivePlayer(player)}>🗃️</button></div></article>)}</div><div className="roster-export"><p className="muted">Respaldo manual del plantel.</p><button className="export-button" onClick={onExport}>↓ Exportar JSON</button></div></section>
}
