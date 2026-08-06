import { playerStatistics, rosterStatistics, type GoalDifferencePoint, type PlayerTrendPoint } from '../domain/statistics'
import type { HistoryEntry, PlayerMatchHistoryEntry } from '../lib/repository'

const fmt = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}`

function TrendLine({ points }: { points: PlayerTrendPoint[] }) {
  if (points.length < 2) return <p className="statistics-empty">Sumá un partido más para ver la evolución.</p>
  const width = 260; const height = 76; const padding = 10
  const values = points.map(({ value }) => value); const min = Math.min(...values); const max = Math.max(...values); const range = max - min || 1
  const coordinates = points.map((point, index) => ({ x: padding + (index * (width - padding * 2)) / (points.length - 1), y: height - padding - ((point.value - min) / range) * (height - padding * 2) }))
  const path = coordinates.map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')
  const latest = points.at(-1)!.value
  const label = `Evolución Elo acumulada: ${points.map((point) => `${new Date(point.createdAt).toLocaleDateString('es-AR')}, ${fmt(point.value)}`).join('; ')}.`
  return <svg className="statistics-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}><path className="statistics-baseline" d={`M ${padding} ${height / 2} H ${width - padding}`} /><path className={`statistics-line ${latest > 0 ? 'positive' : latest < 0 ? 'negative' : 'neutral'}`} d={path} />{coordinates.map(({ x, y }, index) => <circle className="statistics-line-point" cx={x} cy={y} r="3" key={points[index].id}><title>{new Date(points[index].createdAt).toLocaleDateString('es-AR')}: {fmt(points[index].value)}</title></circle>)}</svg>
}

function goalDifferenceLabel(point: GoalDifferencePoint) {
  const date = new Date(point.createdAt).toLocaleDateString('es-AR')
  if (point.outcome === 'draw') return `${date}: empate`
  const winner = point.outcome === 'team_one' ? 'Ganó Claro' : 'Ganó Oscuro'
  return `${date}: ${winner}${point.value === null ? '' : ` por ${point.value}`}`
}

function GoalDifferenceBars({ points }: { points: GoalDifferencePoint[] }) {
  const width = Math.max(120, points.length * 22); const height = 74; const midpoint = height / 2; const max = Math.max(1, ...points.map((point) => point.value ?? 0))
  const label = `Diferencia de goles: ${points.map(goalDifferenceLabel).join('; ')}.`
  return <svg className="statistics-goal-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}><path className="statistics-baseline" d={`M 0 ${midpoint} H ${width}`} />{points.map((point, index) => { const barHeight = point.value === null ? 3 : Math.max(3, (point.value / max) * 28); const isTeamOne = point.outcome === 'team_one'; const color = isTeamOne ? 'team-one' : point.outcome === 'team_two' ? 'team-two' : 'draw'; return <rect className={`statistics-goal-bar ${color}`} key={point.id} x={index * 22 + 5} y={isTeamOne ? midpoint - barHeight : midpoint} width="12" height={barHeight} rx="3"><title>{goalDifferenceLabel(point)}</title></rect> })}</svg>
}

export function RosterStatistics({ history }: { history: HistoryEntry[] }) {
  const stats = rosterStatistics(history)
  return <section className="roster-statistics" aria-labelledby="roster-statistics-title"><div className="statistics-heading"><div><p className="eyebrow">RESUMEN</p><h2 id="roster-statistics-title">El plantel en números</h2></div><small>{history.length} {history.length === 1 ? 'partido cargado' : 'partidos cargados'}</small></div><div className="statistics-results" aria-label={`Resultados: Claro ganó ${stats.results.teamOne}, hubo ${stats.results.draw} empates y Oscuro ganó ${stats.results.teamTwo}.`}><span><b>{stats.results.teamOne}</b> Claro</span><span><b>{stats.results.draw}</b> Empates</span><span><b>{stats.results.teamTwo}</b> Oscuro</span></div><section className="statistics-section" aria-labelledby="goal-difference-title"><div><h3 id="goal-difference-title">Qué tan parejos fueron</h3><p>Diferencia de goles por partido: cada barra se aleja de cero cuanto menos parejo fue.</p></div><GoalDifferenceBars points={stats.goalDifferences} /></section><div className="statistics-movements"><section><h3>Más subieron</h3>{stats.risers.length ? <ol>{stats.risers.map((player) => <li key={player.playerId}><span>{player.playerName}</span><strong className="positive-offset">{fmt(player.offset)}</strong></li>)}</ol> : <p className="statistics-empty">Sin subas todavía.</p>}</section><section><h3>Más bajaron</h3>{stats.fallers.length ? <ol>{stats.fallers.map((player) => <li key={player.playerId}><span>{player.playerName}</span><strong className="negative-offset">{fmt(player.offset)}</strong></li>)}</ol> : <p className="statistics-empty">Sin bajas todavía.</p>}</section></div></section>
}

export function PlayerStatistics({ history, loading }: { history: PlayerMatchHistoryEntry[]; loading: boolean }) {
  if (loading) return <section className="player-statistics" aria-label="Estadísticas del jugador"><p className="muted">Cargando resumen…</p></section>
  const stats = playerStatistics(history)
  const trendCopy = stats.recentTrend === null ? 'Historial inicial: todavía no alcanza para marcar una tendencia.' : stats.recentTrend === 'up' ? `En alza: ${fmt(stats.recentTrendOffset)} en sus últimos ${stats.recentTrendMatches} partidos.` : stats.recentTrend === 'down' ? `En baja: ${fmt(stats.recentTrendOffset)} en sus últimos ${stats.recentTrendMatches} partidos.` : `Sin cambios netos en sus últimos ${stats.recentTrendMatches} partidos.`
  return <section className="player-statistics" aria-labelledby="player-statistics-title"><div className="player-statistics-heading"><h3 id="player-statistics-title">Resumen personal</h3><strong className={stats.netOffset > 0 ? 'positive-offset' : stats.netOffset < 0 ? 'negative-offset' : ''}>{fmt(stats.netOffset)} <small>Elo neto</small></strong></div><div className="player-statistics-results" aria-label={`${stats.results.win} ganados, ${stats.results.draw} empatados y ${stats.results.loss} perdidos.`}><span><b>{stats.results.win}</b> ganados</span><span><b>{stats.results.draw}</b> empatados</span><span><b>{stats.results.loss}</b> perdidos</span></div><div className="player-trend"><div><h4>Evolución Elo</h4><p>{trendCopy}</p></div><TrendLine points={stats.trend} /></div></section>
}
