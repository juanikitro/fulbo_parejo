import { useEffect, useRef, useState } from 'react'
import { applyEloResult, performanceLevels, type PerformanceRating, type RecordedResult } from './domain/elo'
import { createMatchProposal, findComparableSwap } from './domain/matchmaking'
import { operationalRating, type MatchProposal, type Player, type Position, type Team } from './domain/types'
import { playerColors, playerIcons, positionLabel } from './data/catalog'
import { formatMatchShareText } from './lib/matchShare'
import { acceptRosterInvitation, createPlayer, createRosterInvitation, ensureRoster, isRosterOwner, loadHistory, loadLatestPlayerOffsets, loadPlayerMatchHistory, loadPlayers, manageMatchHistory, recordMatch, setArchived, updatePlayer, type HistoryEntry, type PlayerMatchHistoryEntry } from './lib/repository'
import { authErrorMessage } from './lib/authCallback'
import { signInWithGoogle, signOut, supabase } from './lib/supabase'

type Tab = 'squad' | 'match' | 'history'
const fmt = (value: number) => value.toFixed(2)
const blankDraft = { name: '', baseRating: '6', preferredPosition: '', icon: playerIcons[0], color: playerColors[0] }

function OffsetIndicator({ offset }: { offset: number | undefined }) {
  if (!offset) return null
  const positive = offset > 0
  return <small className={`rating-offset ${positive ? 'positive-offset' : 'negative-offset'}`} aria-label={`${positive ? 'Subió' : 'Bajó'} ${Math.abs(offset).toFixed(2)} puntos`}>{positive ? '↑' : '↓'} {positive ? '+' : ''}{fmt(offset)}</small>
}

function PlayerEditor({
  draft,
  editingPlayer,
  saving,
  onClose,
  onSubmit,
  onChange,
}: {
  draft: typeof blankDraft
  editingPlayer: Player | null
  saving: boolean
  onClose: () => void
  onSubmit: (event: React.FormEvent) => void
  onChange: (draft: typeof blankDraft) => void
}) {
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <form className="player-form player-modal" role="dialog" aria-modal="true" aria-labelledby="player-editor-title" onMouseDown={(event) => event.stopPropagation()} onSubmit={onSubmit}>
      <div className="form-heading"><div><p className="eyebrow">{editingPlayer ? 'EDITAR JUGADOR' : 'NUEVO JUGADOR'}</p><h2 id="player-editor-title">{editingPlayer ? editingPlayer.name : 'Sumá al plantel'}</h2></div><button type="button" aria-label="Cerrar" onClick={onClose}>×</button></div>
      <label className="field-label">🧑 Nombre<input autoFocus placeholder="Ej. Juan" value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} /></label>
      <label className="field-label">⭐ Media inicial<input type="number" min="1" max="10" step="0.1" value={draft.baseRating} onChange={(event) => onChange({ ...draft, baseRating: event.target.value })} /></label>
      <label className="field-label">⚽ Posición preferida<select value={draft.preferredPosition} onChange={(event) => onChange({ ...draft, preferredPosition: event.target.value })}><option value="">Sin posición</option>{Object.entries(positionLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <fieldset className="picker-field"><legend>🙂 Ícono</legend><div className="icon-picker">{playerIcons.map((icon) => <button type="button" className={draft.icon === icon ? 'selected' : ''} aria-label={`Usar ${icon}`} aria-pressed={draft.icon === icon} key={icon} onClick={() => onChange({ ...draft, icon })}>{icon}</button>)}</div></fieldset>
      <fieldset className="picker-field"><legend>🎨 Color <span className="color-value">{draft.color}</span></legend><div className="color-picker">{playerColors.map((color) => <button type="button" className={draft.color === color ? 'selected' : ''} aria-label={`Usar color ${color}`} aria-pressed={draft.color === color} key={color} onClick={() => onChange({ ...draft, color })}><i style={{ backgroundColor: color }} /></button>)}</div></fieldset>
      <div className="player-preview"><span style={{ backgroundColor: draft.color }}>{draft.icon}</span><strong>{draft.name || 'Tu jugador'}</strong><small>{draft.baseRating || '–'} de media</small></div>
      <button className="save-player" disabled={saving}>{editingPlayer ? 'Guardar cambios ✓' : 'Crear jugador ✓'}</button>
    </form>
  </div>
}

function ResultEditor({ result, goalDifference, saving, participants, performanceRatings, onClose, onGoalDifferenceChange, onPerformanceChange, onSave, onResultChange }: {
  result: RecordedResult
  goalDifference: string
  saving: boolean
  participants: Pick<Player, 'id' | 'name' | 'icon' | 'color'>[]
  performanceRatings: ReadonlyMap<string, PerformanceRating>
  onClose: () => void
  onGoalDifferenceChange: (value: string) => void
  onPerformanceChange: (playerId: string, rating: PerformanceRating) => void
  onSave: () => void
  onResultChange?: (result: RecordedResult) => void
}) {
  const resultLabel = result === 'teamOne' ? '🏳️ Ganó Claro' : result === 'teamTwo' ? '🌑 Ganó Oscuro' : '🤝 Empate'
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section className="result-modal" role="dialog" aria-modal="true" aria-labelledby="result-editor-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="form-heading"><div><p className="eyebrow">3 · RESULTADO</p><h2 id="result-editor-title">Registrar partido</h2></div><button type="button" aria-label="Cerrar" onClick={onClose}>×</button></div>
      {onResultChange ? <div className="modal-result-actions"><button type="button" className={result === 'teamOne' ? 'selected orange-result' : 'orange-result'} onClick={() => onResultChange('teamOne')}>Ganó Claro</button><button type="button" className={result === 'draw' ? 'selected draw-result' : 'draw-result'} onClick={() => onResultChange('draw')}>Empate</button><button type="button" className={result === 'teamTwo' ? 'selected blue-result' : 'blue-result'} onClick={() => onResultChange('teamTwo')}>Ganó Oscuro</button></div> : <p className="result-choice">{resultLabel}</p>}
      <label className="field-label" htmlFor="goal-difference">🥅 Diferencia de goles <small>opcional</small><input id="goal-difference" type="number" min="0" step="1" placeholder="Ej. 2" value={goalDifference} onChange={(event) => onGoalDifferenceChange(event.target.value)} /></label>
      <fieldset className="performance-field"><legend>⭐ ¿Cómo jugó cada uno?</legend><p>Normal está seleccionado por defecto.</p><div className="performance-list">{participants.map((player) => { const rating = performanceRatings.get(player.id) ?? 0; return <div className="performance-player" key={player.id}><span style={{ backgroundColor: player.color }}>{player.icon}</span><div className="performance-name"><strong>{player.name}</strong><small>{performanceLevels.find((level) => level.value === rating)!.label}</small></div><div className="performance-options" role="group" aria-label={`Cómo jugó ${player.name}`}>{performanceLevels.map(({ value, label }) => <button type="button" aria-label={`${player.name}: ${label}`} aria-pressed={rating === value} className={`performance-option performance-${value + 2}${rating === value ? ' selected' : ''}`} key={value} title={label} onClick={() => onPerformanceChange(player.id, value)}>{value + 3}</button>)}</div></div>})}</div></fieldset>
      <div className="modal-actions"><button type="button" className="cancel-button" onClick={onClose}>Cancelar</button><button className="save-player" disabled={saving} onClick={onSave}>Guardar resultado ✓</button></div>
    </section>
  </div>
}

function PlayerDetail({ player, history, loading, error, onClose }: { player: Player; history: PlayerMatchHistoryEntry[]; loading: boolean; error: string | null; onClose: () => void }) {
  const performanceLabel = (rating: PerformanceRating) => performanceLevels.find((level) => level.value === rating)!.label
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section className="result-modal player-detail-modal" role="dialog" aria-modal="true" aria-labelledby="player-detail-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="form-heading"><div><p className="eyebrow">FICHA DEL JUGADOR</p><h2 id="player-detail-title">{player.name}</h2></div><button type="button" aria-label="Cerrar" onClick={onClose}>×</button></div>
      <div className="player-detail-summary"><span style={{ backgroundColor: player.color }}>{player.icon}</span><div><strong>{fmt(operationalRating(player))}</strong><small>media operativa</small></div><div><strong>{history.length}</strong><small>partidos</small></div></div>
      <div className="player-detail-history"><h3>Partidos jugados</h3>{loading ? <p className="muted">Cargando partidos…</p> : error ? <p className="detail-error">{error}</p> : history.length ? <ol>{history.map((entry) => <li key={entry.id}><div><strong>{new Date(entry.createdAt).toLocaleDateString('es-AR')} · {entry.result === 'win' ? 'Ganó' : entry.result === 'loss' ? 'Perdió' : 'Empató'}</strong><small>{entry.goalDifference === null ? 'Sin diferencia de goles' : `Diferencia de goles: ${entry.goalDifference}`}</small></div><div className="player-match-metrics"><small className={`performance-badge performance-${entry.performanceRating + 2}`}>{performanceLabel(entry.performanceRating)}</small><small className={`rating-offset ${entry.offset > 0 ? 'positive-offset' : entry.offset < 0 ? 'negative-offset' : ''}`}>{entry.offset > 0 ? '+' : ''}{fmt(entry.offset)}</small></div></li>)}</ol> : <p className="muted">Todavía no jugó partidos registrados.</p>}</div>
    </section>
  </div>
}

function RatingInfo({ onClose }: { onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section className="result-modal rating-info-modal" role="dialog" aria-modal="true" aria-labelledby="rating-info-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="form-heading"><div><p className="eyebrow">CÓMO SE CALCULA</p><h2 id="rating-info-title">Las medias del plantel</h2></div><button type="button" aria-label="Cerrar" onClick={onClose}>×</button></div>
      <p><strong>Media base:</strong> la que cargás manualmente para cada jugador.</p>
      <p><strong>Media aprendida:</strong> se ajusta con los resultados de los partidos.</p>
      <p><strong>Media operativa:</strong> es la que usa Nuevo partido para equilibrar los equipos.</p>
      <p className="rating-formula">40% media base + 60% media aprendida</p>
      <button type="button" className="save-player" onClick={onClose}>Entendido</button>
    </section>
  </div>
}

function Pitch({ team }: { team: Team }) {
  const players = [...team.players].sort((a, b) => (a.preferredPosition === 'goalkeeper' ? -1 : 0) - (b.preferredPosition === 'goalkeeper' ? -1 : 0))
  return <div className="pitch" aria-label={`Cancha ${team.name}`}><span className="centre-circle" />{players.map((player) => {
    const row = player.preferredPosition === 'goalkeeper' ? 90 : player.preferredPosition === 'defender' ? 68 : player.preferredPosition === 'midfielder' ? 46 : 24
    const sameRow = players.filter((entry) => (entry.preferredPosition ?? 'none') === (player.preferredPosition ?? 'none'))
    const left = ((sameRow.findIndex((entry) => entry.id === player.id) + 1) / (sameRow.length + 1)) * 100
    return <div className="pitch-player" key={player.id} style={{ left: `${left}%`, top: `${row}%` }} title={player.name}><span style={{ backgroundColor: player.color }}>{player.icon}</span><small>{player.name}</small></div>
  })}</div>
}

function downloadJson(players: Player[]) {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), players }, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'fulbo-matchmaking.json'; anchor.click(); URL.revokeObjectURL(url)
}

async function shareMatch(teamOne: Team, teamTwo: Team) {
  const rosterHeight = Math.max(teamOne.players.length, teamTwo.players.length) * 36
  const pitchTop = 260 + rosterHeight
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = pitchTop + 760
  const context = canvas.getContext('2d')!
  context.fillStyle = '#102e22'; context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#fff5d6'; context.font = '900 58px Archivo Black, system-ui'; context.textAlign = 'center'; context.fillText('PARTIDO ARMADO', 540, 94)
  const drawPitch = (team: Team, left: number, accent: string) => {
    const top = pitchTop; const size = 400
    context.fillStyle = '#20744b'; context.fillRect(left, top, size, 690)
    context.fillStyle = '#1a6741'; for (let stripe = 0; stripe < 8; stripe += 2) context.fillRect(left + stripe * 50, top, 50, 690)
    context.strokeStyle = '#d9f2c3'; context.lineWidth = 7; context.strokeRect(left + 8, top + 8, size - 16, 674); context.beginPath(); context.moveTo(left, top + 345); context.lineTo(left + size, top + 345); context.stroke(); context.beginPath(); context.arc(left + 200, top + 345, 60, 0, Math.PI * 2); context.stroke()
    context.fillStyle = accent; context.fillRect(left, pitchTop - 78, size, 54); context.fillStyle = '#172018'; context.font = '900 28px Manrope, system-ui'; context.fillText(`${team.name} · ${fmt(team.operationalRating / team.players.length)}`, left + 200, pitchTop - 41)
    const players = [...team.players].sort((a, b) => (a.preferredPosition === 'goalkeeper' ? -1 : 0) - (b.preferredPosition === 'goalkeeper' ? -1 : 0))
    players.forEach((player) => {
      const row = player.preferredPosition === 'goalkeeper' ? 90 : player.preferredPosition === 'defender' ? 68 : player.preferredPosition === 'midfielder' ? 46 : 24
      const sameRow = players.filter((entry) => (entry.preferredPosition ?? 'none') === (player.preferredPosition ?? 'none'))
      const index = sameRow.findIndex((entry) => entry.id === player.id)
      const x = left + ((index + 1) / (sameRow.length + 1)) * size; const y = top + (row / 100) * 690
      context.fillStyle = player.color; context.beginPath(); context.arc(x, y, 27, 0, Math.PI * 2); context.fill(); context.strokeStyle = '#fffbed'; context.lineWidth = 4; context.stroke()
      context.fillStyle = '#172018'; context.font = '22px system-ui'; context.fillText(player.icon, x, y + 8)
      context.fillStyle = '#fffbed'; context.font = '800 16px Manrope, system-ui'; context.fillText(player.name, x, y - 39)
    })
  }
  const drawRoster = (team: Team, left: number) => {
    context.textAlign = 'left'; context.fillStyle = '#fff5d6'; context.font = '800 26px Manrope, system-ui'
    team.players.forEach((player, index) => context.fillText(`• ${player.name}`, left, 164 + index * 36))
    context.textAlign = 'center'
  }
  drawRoster(teamOne, 70); drawRoster(teamTwo, 610)
  drawPitch(teamOne, 70, '#ffb36e'); drawPitch(teamTwo, 610, '#9dc4ff')
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  const text = formatMatchShareText(teamOne, teamTwo)
  if (blob && navigator.canShare?.({ files: [new File([blob], 'partido.png', { type: 'image/png' })] })) { await navigator.share({ files: [new File([blob], 'partido.png', { type: 'image/png' })] }); return }
  await navigator.clipboard?.writeText(text)
  if (blob) { const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'partido.png'; anchor.click(); URL.revokeObjectURL(url) }
}

export default function App() {
  const configured = Boolean(supabase)
  const [tab, setTab] = useState<Tab>('match')
  const [sessionReady, setSessionReady] = useState(!configured)
  const [userId, setUserId] = useState<string | null>(null)
  const [rosterId, setRosterId] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])
  const [latestOffsets, setLatestOffsets] = useState(new Map<string, number>())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [proposal, setProposal] = useState<MatchProposal | null>(null)
  const [balancedProposal, setBalancedProposal] = useState<MatchProposal | null>(null)
  const [customMode, setCustomMode] = useState(false)
  const [manualSelection, setManualSelection] = useState<{ playerId: string; team: 'teamOne' | 'teamTwo' } | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [draft, setDraft] = useState(blankDraft)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)
  const [pendingResult, setPendingResult] = useState<RecordedResult | null>(null)
  const [editingHistory, setEditingHistory] = useState<HistoryEntry | null>(null)
  const [historyResult, setHistoryResult] = useState<RecordedResult>('draw')
  const [goalDifference, setGoalDifference] = useState('')
  const [performanceRatings, setPerformanceRatings] = useState<Map<string, PerformanceRating>>(new Map())
  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null)
  const [playerMatchHistory, setPlayerMatchHistory] = useState<PlayerMatchHistoryEntry[]>([])
  const [playerHistoryLoading, setPlayerHistoryLoading] = useState(false)
  const [playerHistoryError, setPlayerHistoryError] = useState<string | null>(null)
  const detailRequest = useRef(0)
  const [ratingInfoOpen, setRatingInfoOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const db = supabase
    if (!db) return
    let live = true
    const sync = (id: string | null) => { if (live) { setUserId(id); setSessionReady(true) } }
    db.auth.getSession().then(({ data }) => sync(data.session?.user.id ?? null))
    const { data: listener } = db.auth.onAuthStateChange((_event, session) => sync(session?.user.id ?? null))
    return () => { live = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    const error = authErrorMessage()
    if (error) setMessage(`No se pudo iniciar sesión: ${error}`)
  }, [])

  useEffect(() => {
    const db = supabase
    if (!db || !userId) return
    let live = true
    const load = async () => {
      try {
        const { data: auth } = await db.auth.getUser()
        if (!auth.user) return
        const token = new URLSearchParams(window.location.search).get('invite')
        const id = token ? await acceptRosterInvitation(token) : await ensureRoster(auth.user)
        const [loadedPlayers, loadedHistory, loadedOffsets] = await Promise.all([loadPlayers(id), loadHistory(id), loadLatestPlayerOffsets(id)])
        const owner = await isRosterOwner(id, auth.user.id)
        if (token) window.history.replaceState({}, '', window.location.pathname)
        if (live) { setRosterId(id); setIsOwner(owner); setPlayers(loadedPlayers); setLatestOffsets(loadedOffsets); setSelected(new Set()); setHistory(loadedHistory); if (token) setMessage('Te sumaste al plantel compartido.') }
      } catch (error) { if (live) setMessage(error instanceof Error ? error.message : 'No se pudo cargar tu plantel.') }
    }
    void load()
    return () => { live = false }
  }, [userId])

  const active = players.filter((player) => !player.archived)
  const selectedPlayers = players.filter((player) => selected.has(player.id) && !player.archived)
  const mean = (team: Team) => team.operationalRating / team.players.length
  const makeTeams = () => { try { const next = createMatchProposal(selectedPlayers); setProposal(next); setBalancedProposal(next); setCustomMode(false); setManualSelection(null) } catch (error) { window.alert(error instanceof Error ? error.message : 'No se pudo armar el partido.') } }
  const swapDirectly = (oneId: string, twoId: string) => {
    if (!proposal) return
    const teamOnePlayers = proposal.teamOne.players.map((player) => player.id === oneId ? proposal.teamTwo.players.find((entry) => entry.id === twoId)! : player)
    const teamTwoPlayers = proposal.teamTwo.players.map((player) => player.id === twoId ? proposal.teamOne.players.find((entry) => entry.id === oneId)! : player)
    const teamOne = { ...proposal.teamOne, players: teamOnePlayers, operationalRating: teamOnePlayers.reduce((sum, entry) => sum + operationalRating(entry), 0) }
    const teamTwo = { ...proposal.teamTwo, players: teamTwoPlayers, operationalRating: teamTwoPlayers.reduce((sum, entry) => sum + operationalRating(entry), 0) }
    setProposal({ ...proposal, teamOne, teamTwo, balanceGap: Math.abs(teamOne.operationalRating - teamTwo.operationalRating) })
  }
  const selectManualPlayer = (playerId: string, team: 'teamOne' | 'teamTwo') => {
    if (!manualSelection) { setManualSelection({ playerId, team }); setMessage('Modo custom: elegí un jugador del otro equipo para intercambiar.'); return }
    if (manualSelection.team === team) { setManualSelection({ playerId, team }); setMessage('Elegí ahora un jugador del otro equipo.'); return }
    swapDirectly(team === 'teamOne' ? playerId : manualSelection.playerId, team === 'teamTwo' ? playerId : manualSelection.playerId)
    setManualSelection(null)
  }
  const swapComparable = (playerId: string, source: 'teamOne' | 'teamTwo') => {
    if (!proposal) return
    if (customMode) { selectManualPlayer(playerId, source); return }
    const origin = source === 'teamOne' ? proposal.teamOne : proposal.teamTwo
    const destination = source === 'teamOne' ? proposal.teamTwo : proposal.teamOne
    const player = origin.players.find((entry) => entry.id === playerId)
    if (!player) return
    const counterpart = findComparableSwap(player, destination.players)
    if (!counterpart) { setMessage(`No hay un cambio compatible para ${player.name}.`); return }
    const nextOrigin = origin.players.map((entry) => entry.id === player.id ? counterpart : entry)
    const nextDestination = destination.players.map((entry) => entry.id === counterpart.id ? player : entry)
    const teamOnePlayers = source === 'teamOne' ? nextOrigin : nextDestination
    const teamTwoPlayers = source === 'teamOne' ? nextDestination : nextOrigin
    const teamOne = { ...proposal.teamOne, players: teamOnePlayers, operationalRating: teamOnePlayers.reduce((sum, entry) => sum + operationalRating(entry), 0) }
    const teamTwo = { ...proposal.teamTwo, players: teamTwoPlayers, operationalRating: teamTwoPlayers.reduce((sum, entry) => sum + operationalRating(entry), 0) }
    setProposal({ ...proposal, teamOne, teamTwo, balanceGap: Math.abs(teamOne.operationalRating - teamTwo.operationalRating) })
    setMessage(`🔄 ${player.name} cambió por ${counterpart.name}.`)
  }
  const openPlayerEditor = (player?: Player) => {
    setEditingPlayer(player ?? null)
    setDraft(player ? { name: player.name, baseRating: String(player.baseRating), preferredPosition: player.preferredPosition ?? '', icon: player.icon, color: player.color } : blankDraft)
    setEditorOpen(true)
  }
  const openResultEditor = (result: RecordedResult) => {
    if (!proposal) return
    setPerformanceRatings(new Map([...proposal.teamOne.players, ...proposal.teamTwo.players].map((player) => [player.id, 0] as const)))
    setPendingResult(result)
  }
  const closeResultEditor = () => { setPendingResult(null); setGoalDifference(''); setPerformanceRatings(new Map()) }
  const openHistoryEditor = (entry: HistoryEntry) => {
    setEditingHistory(entry)
    setHistoryResult(entry.outcome === 'team_one' ? 'teamOne' : entry.outcome === 'team_two' ? 'teamTwo' : 'draw')
    setGoalDifference(entry.goalDifference === null ? '' : String(entry.goalDifference))
    setPerformanceRatings(new Map(entry.playerOffsets.map(({ playerId, performanceRating }) => [playerId, performanceRating] as const)))
  }
  const closeHistoryEditor = () => { setEditingHistory(null); setGoalDifference(''); setPerformanceRatings(new Map()) }
  const setPlayerPerformance = (playerId: string, rating: PerformanceRating) => setPerformanceRatings((current) => new Map(current).set(playerId, rating))
  const openPlayerDetail = async (player: Player) => {
    if (!rosterId) return
    const request = ++detailRequest.current
    setDetailPlayer(player); setPlayerMatchHistory([]); setPlayerHistoryError(null); setPlayerHistoryLoading(true)
    try {
      const entries = await loadPlayerMatchHistory(rosterId, player.id)
      if (request === detailRequest.current) setPlayerMatchHistory(entries)
    } catch (error) {
      if (request === detailRequest.current) setPlayerHistoryError(error instanceof Error ? error.message : 'No se pudieron cargar los partidos.')
    } finally {
      if (request === detailRequest.current) setPlayerHistoryLoading(false)
    }
  }
  const closePlayerDetail = () => { detailRequest.current += 1; setDetailPlayer(null); setPlayerMatchHistory([]); setPlayerHistoryError(null) }
  const savePlayer = async (event: React.FormEvent) => {
    event.preventDefault(); if (!rosterId || !draft.name.trim()) return
    const rating = Number(draft.baseRating)
    if (!Number.isFinite(rating) || rating < 1 || rating > 10) { setMessage('La media debe estar entre 1 y 10.'); return }
    setSaving(true)
    try {
      const attributes = { name: draft.name, baseRating: rating, learnedRating: editingPlayer?.learnedRating ?? rating, eloSeed: editingPlayer?.eloSeed ?? rating, preferredPosition: (draft.preferredPosition || undefined) as Position | undefined, icon: draft.icon, color: draft.color }
      const player = editingPlayer ? await updatePlayer(editingPlayer.id, attributes) : await createPlayer(rosterId, attributes)
      setPlayers((current) => editingPlayer ? current.map((entry) => entry.id === player.id ? player : entry) : [...current, player])
      setEditorOpen(false); setEditingPlayer(null); setDraft(blankDraft)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo guardar el jugador.') } finally { setSaving(false) }
  }
  const archive = async (player: Player) => {
    if (!window.confirm(`¿Archivar a ${player.name}? Podés recuperarlo luego desde la base de datos.`)) return
    try { await setArchived(player.id, true); setPlayers((current) => current.map((entry) => entry.id === player.id ? { ...entry, archived: true } : entry)); setSelected((current) => { const next = new Set(current); next.delete(player.id); return next }) } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo archivar el jugador.') }
  }
  const record = async (result: RecordedResult) => {
    if (!proposal || !rosterId) return
    setSaving(true)
    try {
      const margin = goalDifference === '' ? undefined : Number(goalDifference)
      if (margin !== undefined && (!Number.isInteger(margin) || margin < 0)) throw new Error('La diferencia de goles debe ser un entero positivo.')
      const updates = applyEloResult(proposal.teamOne.players, proposal.teamTwo.players, result, margin, performanceRatings)
      await recordMatch(rosterId, proposal.teamOne, proposal.teamTwo, proposal.unassigned?.id, result, updates, margin, performanceRatings)
      setPlayers((current) => current.map((player) => ({ ...player, learnedRating: updates.get(player.id) ?? player.learnedRating })))
      const [updatedHistory, updatedOffsets] = await Promise.all([loadHistory(rosterId), loadLatestPlayerOffsets(rosterId)])
      setHistory(updatedHistory); setLatestOffsets(updatedOffsets); closeResultEditor(); setMessage('Resultado guardado y medias actualizadas.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo registrar el resultado.') } finally { setSaving(false) }
  }
  const saveHistoryEdit = async () => {
    if (!editingHistory || !rosterId) return
    setSaving(true)
    try {
      const margin = goalDifference === '' ? undefined : Number(goalDifference)
      if (margin !== undefined && (!Number.isInteger(margin) || margin < 0)) throw new Error('La diferencia de goles debe ser un entero positivo.')
      await manageMatchHistory(editingHistory.id, 'edit', historyResult === 'teamOne' ? 'team_one' : historyResult === 'teamTwo' ? 'team_two' : 'draw', margin, performanceRatings)
      const [updatedPlayers, updatedHistory, updatedOffsets] = await Promise.all([loadPlayers(rosterId), loadHistory(rosterId), loadLatestPlayerOffsets(rosterId)])
      setPlayers(updatedPlayers); setHistory(updatedHistory); setLatestOffsets(updatedOffsets); closeHistoryEditor(); setMessage('Partido editado y medias recalculadas.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo editar el partido.') } finally { setSaving(false) }
  }
  const deleteHistoryEntry = async (entry: HistoryEntry) => {
    if (!rosterId || !window.confirm('¿Borrar este partido? Se recalcularán las medias Elo.')) return
    setSaving(true)
    try {
      await manageMatchHistory(entry.id, 'delete')
      const [updatedPlayers, updatedHistory, updatedOffsets] = await Promise.all([loadPlayers(rosterId), loadHistory(rosterId), loadLatestPlayerOffsets(rosterId)])
      setPlayers(updatedPlayers); setHistory(updatedHistory); setLatestOffsets(updatedOffsets); setMessage('Partido borrado y medias recalculadas.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo borrar el partido.') } finally { setSaving(false) }
  }
  const logout = async () => {
    setSaving(true)
    try { await signOut() } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo cerrar sesión.') } finally { setSaving(false) }
  }
  const login = async () => {
    try { await signInWithGoogle() } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo iniciar sesión.') }
  }
  const invite = async () => {
    if (!rosterId) return
    setSaving(true)
    try {
      const invitation = await createRosterInvitation(rosterId)
      const url = `${window.location.origin}${window.location.pathname}?invite=${invitation.token}`
      try { await navigator.clipboard.writeText(url); setMessage('Link de invitación copiado. Vence en 7 días y se usa una sola vez.') }
      catch { window.prompt('Copiá este link de invitación:', url); setMessage('Compartí el link antes de que venza.') }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo crear la invitación.') } finally { setSaving(false) }
  }
  const historyParticipants = editingHistory?.playerOffsets.map((participant) => players.find((player) => player.id === participant.playerId) ?? { id: participant.playerId, name: participant.playerName, icon: '⚽', color: '#879381' }) ?? []

  if (!configured) return <main className="app-shell"><header className="topbar"><h1>Fulbo Parejo</h1></header><section className="panel"><p className="eyebrow">CONFIGURACIÓN PENDIENTE</p><h2>Conectá Supabase para usar tu plantel privado.</h2><p className="muted">Faltan las variables públicas de Supabase en este entorno.</p></section></main>
  if (!sessionReady) return <main className="app-shell"><section className="panel"><h2>Cargando tu vestuario…</h2></section></main>
  if (!userId) return <main className="app-shell login-shell"><header className="topbar"><h1>Fulbo Parejo</h1></header><section className="panel login-panel"><p className="eyebrow">PLANTEL PRIVADO</p><h2>Tu convocatoria empieza acá.</h2><p className="muted">Entrá con tu cuenta para guardar medias, resultados y tu plantel.</p>{message && <p className="demo-banner">{message} <button onClick={() => setMessage(null)}>×</button></p>}<button className="google-login" onClick={() => void login()}><span>G</span>Continuar con Google <b>→</b></button></section></main>

  return <main className="app-shell">
    <header className="topbar"><h1>Fulbo Parejo</h1><div className="header-actions">{isOwner && <button className="invite-button" disabled={saving} onClick={() => void invite()}>Invitar 🔗</button>}<button className="logout-button" disabled={saving} onClick={() => void logout()}>Salir ↗</button></div></header>
    {message && <p className="demo-banner">{message} <button onClick={() => setMessage(null)}>×</button></p>}
    {tab === 'squad' && <section className="panel"><div className="panel-heading"><div><p className="eyebrow">TU PLANTEL</p><div className="squad-title-row"><h2>{active.length} jugadores activos</h2><button type="button" className="rating-info-button" aria-label="Explicar las medias" aria-haspopup="dialog" onClick={() => setRatingInfoOpen(true)}>i</button></div></div><button onClick={() => openPlayerEditor()}>+ Crear jugador</button></div><div className="squad-grid">{active.map((player) => <article className="player-card" key={player.id}><button type="button" className="player-detail-trigger" aria-label={`Ver ficha de ${player.name}`} onClick={() => void openPlayerDetail(player)}><span className="player-icon" style={{ backgroundColor: player.color }}>{player.icon}</span><span><strong>{player.name}</strong><small>{player.preferredPosition ? positionLabel[player.preferredPosition] : 'Sin posición'}</small></span></button><b>{player.baseRating} <small>({fmt(player.learnedRating)})</small></b><OffsetIndicator offset={latestOffsets.get(player.id)} /><div className="player-actions"><button aria-label={`Editar ${player.name}`} onClick={() => openPlayerEditor(player)}>✏️</button><button aria-label={`Archivar ${player.name}`} onClick={() => void archive(player)}>🗃️</button></div></article>)}</div><div className="roster-export"><p className="muted">Respaldo manual del plantel.</p><button className="export-button" onClick={() => downloadJson(players)}>↓ Exportar JSON</button></div></section>}
    {tab === 'match' && <section className="match-flow"><section className="panel callup"><div className="panel-heading"><div><p className="eyebrow">1 · CONVOCATORIA</p><h2>¿Quiénes vinieron?</h2><p className="callup-counter">👥 {selectedPlayers.length} de {active.length} confirmados</p></div><div className="callup-actions"><button className="make-teams-button" onClick={makeTeams}>Armar equipos →</button>{proposal && <button className={customMode ? 'custom-mode-toggle active' : 'custom-mode-toggle'} aria-label="Activar modo custom" title="Modo custom" onClick={() => { const next = !customMode; setCustomMode(next); setManualSelection(null); setMessage(next ? 'Modo custom activo: tocá un jugador de cada equipo para intercambiarlos libremente.' : 'Modo equilibrado activo.') }}>{customMode ? '✦' : '🛠️'}</button>}</div></div><div className="chip-list">{active.map((player) => <button className={selected.has(player.id) ? 'player-chip selected' : 'player-chip'} key={player.id} onClick={() => setSelected((current) => { const next = new Set(current); next.has(player.id) ? next.delete(player.id) : next.add(player.id); return next })}><span style={{ backgroundColor: player.color }}>{player.icon}</span>{player.name}</button>)}</div>{active.length === 0 && <p className="muted">Primero cargá los jugadores desde Plantel.</p>}</section>
      {proposal && <><section className="versus"><div className="team-card orange"><p className="eyebrow">{proposal.teamOne.name}</p><h2>{fmt(mean(proposal.teamOne))}</h2><span>media operativa</span>{proposal.teamOne.players.map((player) => <div className="team-player" key={player.id}><button type="button" className="team-player-detail" aria-label={`Ver ficha de ${player.name}`} onClick={() => void openPlayerDetail(player)}><i style={{ backgroundColor: player.color }}>{player.icon}</i>{player.name}</button><button type="button" className="team-player-swap" aria-label={`Cambiar a ${player.name} de equipo`} onClick={() => swapComparable(player.id, 'teamOne')}><span className="team-player-details"><OffsetIndicator offset={latestOffsets.get(player.id)} /><small>{fmt(operationalRating(player))}</small></span>↔</button></div>)}</div><div className="vs">VS <small>Δ {fmt(proposal.balanceGap)}</small></div><div className="team-card blue"><p className="eyebrow">{proposal.teamTwo.name}</p><h2>{fmt(mean(proposal.teamTwo))}</h2><span>media operativa</span>{proposal.teamTwo.players.map((player) => <div className="team-player" key={player.id}><button type="button" className="team-player-detail" aria-label={`Ver ficha de ${player.name}`} onClick={() => void openPlayerDetail(player)}><i style={{ backgroundColor: player.color }}>{player.icon}</i>{player.name}</button><button type="button" className="team-player-swap" aria-label={`Cambiar a ${player.name} de equipo`} onClick={() => swapComparable(player.id, 'teamTwo')}><span className="team-player-details"><OffsetIndicator offset={latestOffsets.get(player.id)} /><small>{fmt(operationalRating(player))}</small></span>↔</button></div>)}</div></section>{proposal.unassigned && <p className="unassigned">No asignado para maximizar equilibrio: <strong>{proposal.unassigned.name}</strong></p>}<section className="panel pitch-panel"><div className="panel-heading"><div><p className="eyebrow">2 · PIZARRA</p><h2>Cancha del partido</h2></div><button onClick={() => void shareMatch(proposal.teamOne, proposal.teamTwo)}>Compartir ↗</button></div><div className="pitches"><Pitch team={proposal.teamOne} /><Pitch team={proposal.teamTwo} /></div></section><section className="panel result"><p className="eyebrow">3 · RESULTADO</p><h2>¿Quién ganó?</h2><div className="result-actions"><button className="orange-result" disabled={saving} onClick={() => openResultEditor('teamOne')}>Ganó Claro</button><button className="draw-result" disabled={saving} onClick={() => openResultEditor('draw')}>Empate</button><button className="blue-result" disabled={saving} onClick={() => openResultEditor('teamTwo')}>Ganó Oscuro</button></div></section></>}</section>}
    {tab === 'history' && <section className="panel"><p className="eyebrow">HISTORIAL</p><h2>Últimos partidos</h2>{history.length ? <ol className="history">{history.map((entry) => <li key={entry.id}><div><span>{new Date(entry.createdAt).toLocaleDateString('es-AR')} · {entry.outcome === 'draw' ? 'Empate' : entry.outcome === 'team_one' ? 'Ganó Claro' : 'Ganó Oscuro'}{entry.goalDifference !== null ? ` · Δ ${entry.goalDifference}` : ''}</span><div className="player-offsets">{entry.playerOffsets.map(({ playerId, playerName, offset }) => <small className={offset > 0 ? 'positive-offset' : offset < 0 ? 'negative-offset' : ''} key={playerId}>{playerName} {offset > 0 ? '+' : ''}{fmt(offset)}</small>)}</div></div><div className="history-actions"><button disabled={saving} onClick={() => openHistoryEditor(entry)}>✏️</button><button disabled={saving} onClick={() => void deleteHistoryEntry(entry)}>🗑️</button></div></li>)}</ol> : <p className="muted">Todavía no registraste resultados.</p>}</section>}
    {editorOpen && <PlayerEditor draft={draft} editingPlayer={editingPlayer} saving={saving} onClose={() => setEditorOpen(false)} onSubmit={(event) => void savePlayer(event)} onChange={setDraft} />}
    {pendingResult && proposal && <ResultEditor result={pendingResult} goalDifference={goalDifference} saving={saving} participants={[...proposal.teamOne.players, ...proposal.teamTwo.players]} performanceRatings={performanceRatings} onClose={closeResultEditor} onGoalDifferenceChange={setGoalDifference} onPerformanceChange={setPlayerPerformance} onSave={() => void record(pendingResult)} />}
    {editingHistory && <ResultEditor result={historyResult} goalDifference={goalDifference} saving={saving} participants={historyParticipants} performanceRatings={performanceRatings} onClose={closeHistoryEditor} onGoalDifferenceChange={setGoalDifference} onPerformanceChange={setPlayerPerformance} onResultChange={setHistoryResult} onSave={() => void saveHistoryEdit()} />}
    {detailPlayer && <PlayerDetail player={detailPlayer} history={playerMatchHistory} loading={playerHistoryLoading} error={playerHistoryError} onClose={closePlayerDetail} />}
    {ratingInfoOpen && <RatingInfo onClose={() => setRatingInfoOpen(false)} />}
    <nav className="bottom-nav">{([['squad', '👥', 'Plantel'], ['match', '⚽', 'Nuevo partido'], ['history', '📋', 'Historial']] as const).map(([key, icon, label]) => <button className={tab === key ? 'active' : ''} key={key} onClick={() => setTab(key)}><span>{icon}</span>{label}</button>)}</nav>
  </main>
}
