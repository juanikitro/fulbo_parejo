import { positionLabel } from '../data/catalog'
import type { Player } from '../domain/types'

type SquadTabProps = {
  activePlayers: Player[]
  players: Player[]
  latestOffsets: ReadonlyMap<string, number>
  onCreatePlayer: () => void
  onOpenPlayerDetail: (player: Player) => void | Promise<void>
  onEditPlayer: (player: Player) => void
  onArchivePlayer: (player: Player) => void | Promise<void>
  onOpenRatingInfo: () => void
  onExport: () => void
}

function OffsetIndicator({ offset }: { offset: number | undefined }) {
  if (!offset) return null
  const positive = offset > 0
  return <small className={`rating-offset ${positive ? 'positive-offset' : 'negative-offset'}`} aria-label={`${positive ? 'Subió' : 'Bajó'} ${Math.abs(offset).toFixed(2)} puntos`}>{positive ? '↑' : '↓'} {positive ? '+' : ''}{offset.toFixed(2)}</small>
}

export default function SquadTab({ activePlayers, players, latestOffsets, onCreatePlayer, onOpenPlayerDetail, onEditPlayer, onArchivePlayer, onOpenRatingInfo, onExport }: SquadTabProps) {
  return <section className="panel"><div className="panel-heading"><div><p className="eyebrow">TU PLANTEL</p><div className="squad-title-row"><h2>{activePlayers.length} jugadores activos</h2><button type="button" className="rating-info-button" aria-label="Explicar las medias" aria-haspopup="dialog" onClick={onOpenRatingInfo}>i</button></div></div><button onClick={onCreatePlayer}>+ Crear jugador</button></div><div className="squad-grid">{activePlayers.map((player) => <article className="player-card" key={player.id}><button type="button" className="player-detail-trigger" aria-label={`Ver ficha de ${player.name}`} onClick={() => void onOpenPlayerDetail(player)}><span className="player-icon" style={{ backgroundColor: player.color }}>{player.icon}</span><span><strong>{player.name}</strong><small>{player.preferredPosition ? positionLabel[player.preferredPosition] : 'Sin posición'}</small></span></button><b>{player.baseRating} <small>({player.learnedRating.toFixed(2)})</small></b><OffsetIndicator offset={latestOffsets.get(player.id)} /><div className="player-actions"><button aria-label={`Editar ${player.name}`} onClick={() => onEditPlayer(player)}>✏️</button><button aria-label={`Archivar ${player.name}`} onClick={() => void onArchivePlayer(player)}>🗃️</button></div></article>)}</div><div className="roster-export"><p className="muted">Respaldo manual del plantel.</p><button className="export-button" onClick={onExport}>↓ Exportar JSON</button></div></section>
}
