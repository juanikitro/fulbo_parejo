import type { HistoryEntry } from '../lib/repository'

type HistoryTabProps = {
  history: HistoryEntry[]
  saving: boolean
  onEdit: (entry: HistoryEntry) => void
  onDelete: (entry: HistoryEntry) => void | Promise<void>
}

const fmt = (value: number) => value.toFixed(2)

export default function HistoryTab({ history, saving, onEdit, onDelete }: HistoryTabProps) {
  return <section className="panel"><p className="eyebrow">HISTORIAL</p><h2>Últimos partidos</h2>{history.length ? <ol className="history">{history.map((entry) => <li key={entry.id}><div><span>{new Date(entry.createdAt).toLocaleDateString('es-AR')} · {entry.outcome === 'draw' ? 'Empate' : entry.outcome === 'team_one' ? 'Ganó Claro' : 'Ganó Oscuro'}{entry.goalDifference !== null ? ` · Δ ${entry.goalDifference}` : ''}</span><div className="player-offsets">{entry.playerOffsets.map(({ playerId, playerName, offset }) => <small className={offset > 0 ? 'positive-offset' : offset < 0 ? 'negative-offset' : ''} key={playerId}>{playerName} {offset > 0 ? '+' : ''}{fmt(offset)}</small>)}</div></div><div className="history-actions"><button disabled={saving} onClick={() => onEdit(entry)}>✏️</button><button disabled={saving} onClick={() => void onDelete(entry)}>🗑️</button></div></li>)}</ol> : <p className="muted">Todavía no registraste resultados.</p>}</section>
}
