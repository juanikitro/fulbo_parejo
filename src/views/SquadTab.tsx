import { useMemo, useState } from 'react'
import { positionLabel } from '../data/catalog'
import { operationalRating, positions, type Player } from '../domain/types'

type SortBy = 'rating' | 'name' | 'position' | 'offset'

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

function normalizedName(name: string) {
  return name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es-AR')
}

export default function SquadTab({ activePlayers, players, latestOffsets, onCreatePlayer, onOpenPlayerDetail, onEditPlayer, onArchivePlayer, onExport }: SquadTabProps) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('rating')
  const visiblePlayers = useMemo(() => {
    const searchTerm = normalizedName(search.trim())
    const byName = (a: Player, b: Player) => a.name.localeCompare(b.name, 'es-AR')
    const positionIndex = (player: Player) => player.preferredPosition ? positions.indexOf(player.preferredPosition) : positions.length

    return [...activePlayers]
      .filter((player) => !searchTerm || normalizedName(player.name).includes(searchTerm))
      .sort((a, b) => {
        if (sortBy === 'name') return byName(a, b)
        if (sortBy === 'position') return positionIndex(a) - positionIndex(b) || byName(a, b)
        if (sortBy === 'offset') return (latestOffsets.get(b.id) ?? 0) - (latestOffsets.get(a.id) ?? 0) || byName(a, b)
        return operationalRating(b) - operationalRating(a) || byName(a, b)
      })
  }, [activePlayers, latestOffsets, search, sortBy])

  return <section className="panel"><div className="panel-heading"><div><p className="eyebrow">TU PLANTEL</p><h2>{activePlayers.length} jugadores activos</h2></div><button onClick={onCreatePlayer}>+ Crear jugador</button></div><div className="squad-controls"><label className="squad-control"><span>Buscar jugador</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre…" /></label><label className="squad-control"><span>Ordenar por</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortBy)}><option value="rating">Puntaje</option><option value="name">Nombre</option><option value="position">Posición</option><option value="offset">Buff/debuff</option></select></label></div>{visiblePlayers.length ? <div className="squad-grid">{visiblePlayers.map((player) => <article className="player-card" key={player.id}><button type="button" className="player-detail-trigger" aria-label={`Ver ficha de ${player.name}`} onClick={() => void onOpenPlayerDetail(player)}><span className="player-icon" style={{ backgroundColor: player.color }}>{player.icon}</span><span><strong>{player.name}</strong><small>{player.preferredPosition ? `${player.preferredPosition} · ${positionLabel[player.preferredPosition]}` : 'Sin posición'}</small></span></button><b>{player.baseRating} <small>({player.learnedRating.toFixed(2)})</small></b><OffsetIndicator offset={latestOffsets.get(player.id)} /><div className="player-actions"><button aria-label={`Editar ${player.name}`} onClick={() => onEditPlayer(player)}>✏️</button><button aria-label={`Archivar ${player.name}`} onClick={() => void onArchivePlayer(player)}>🗃️</button></div></article>)}</div> : <p className="muted squad-empty">No encontramos jugadores con ese nombre.</p>}<div className="roster-export"><p className="muted">Respaldo manual del plantel.</p><button className="export-button" onClick={onExport}>↓ Exportar JSON</button></div></section>
}
