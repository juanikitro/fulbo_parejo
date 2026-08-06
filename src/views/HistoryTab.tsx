import type { HistoryEntry } from '../lib/repository'
import { RosterStatistics } from './Statistics'

type HistoryTabProps = {
  history: HistoryEntry[]
  saving: boolean
  hasMore: boolean
  loadingMore: boolean
  onEdit: (entry: HistoryEntry) => void
  onDelete: (entry: HistoryEntry) => void | Promise<void>
  onLoadMore: () => void | Promise<void>
}

const fmt = (value: number) => value.toFixed(2)
const sortByOffset = (offsets: HistoryEntry['playerOffsets']) => [...offsets].sort((a, b) => b.offset - a.offset)

function OffsetPills({ offsets, label }: { offsets: HistoryEntry['playerOffsets']; label: string }) {
  return <div className="player-offsets" aria-label={label}>{sortByOffset(offsets).map(({ playerId, playerName, offset }) => <small className={offset > 0 ? 'positive-offset' : offset < 0 ? 'negative-offset' : ''} key={playerId}>{playerName} {offset > 0 ? '+' : ''}{fmt(offset)}</small>)}</div>
}

export default function HistoryTab({ history, saving, hasMore, loadingMore, onEdit, onDelete, onLoadMore }: HistoryTabProps) {
  return <section className="panel"><p className="eyebrow">HISTORIAL</p>{history.length ? <><RosterStatistics history={history} /><h2 className="history-list-title">Últimos partidos</h2><ol className="history">{history.map((entry) => <li key={entry.id}><div><span>{new Date(entry.createdAt).toLocaleDateString('es-AR')} · {entry.outcome === 'draw' ? 'Empate' : entry.outcome === 'team_one' ? 'Ganó Claro' : 'Ganó Oscuro'}{entry.goalDifference !== null ? ` · Δ ${entry.goalDifference}` : ''}</span>{entry.outcome === 'draw' ? <OffsetPills offsets={entry.playerOffsets} label="Empate" /> : <><OffsetPills offsets={entry.playerOffsets.filter(({ offset }) => offset >= 0)} label="Ganadores" /><OffsetPills offsets={entry.playerOffsets.filter(({ offset }) => offset < 0)} label="Perdedores" /></>}</div><div className="history-actions"><button disabled={saving} onClick={() => onEdit(entry)}>✏️</button><button disabled={saving} onClick={() => void onDelete(entry)}>🗑️</button></div></li>)}</ol>{hasMore && <button className="history-more-button" disabled={loadingMore} onClick={() => void onLoadMore()}>{loadingMore ? 'Cargando…' : 'Ver partidos anteriores'}</button>}</> : <><h2>Últimos partidos</h2><p className="muted">Todavía no registraste resultados.</p></>}</section>
}
