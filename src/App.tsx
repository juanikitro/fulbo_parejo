import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { chemistryExtremes, chemistryFromHistory, chemistryPairsFromHistory, chemistryWithSufficientEvidence, type ChemistryPair, type PairChemistry } from './domain/chemistry'
import { groupCallupPlayers } from './domain/callup'
import { performanceLevels, type PerformanceRating, type RecordedResult } from './domain/elo'
import { initialRatingValidationMessage, parseInitialRating } from './domain/initialRating'
import { createMatchProposal, findComparableSwap } from './domain/matchmaking'
import { describeMatchProposal } from './domain/matchmakingExplanation'
import { isGoalkeeper, operationalRating, partitionPlayers, positions, type MatchProposal, type Player, type Position, type Team } from './domain/types'
import { playerColors, playerIcons, positionLabel } from './data/catalog'
import { formatMatchShareText, formatShareMovement } from './lib/matchShare'
import { canEditRoster, canInviteRole, canManageRosterAccess, canPlanMatch, generateWhatsAppInvitation, runOnce, type RosterAccessEntry, type RosterRole } from './lib/rosterAccess'
import { acceptRosterInvitation, createPlayer, createRoster, createRosterInvitation, loadAccessibleRosters, loadActiveRosterId, loadChemistryHistory, loadHistory, loadLatestPlayerOffsets, loadPlayerMatchHistory, loadPlayers, loadRosterAccess, loadRosterRole, manageMatchHistory, recordMatch, removeRosterAccess, renameRoster, saveActiveRosterId, setArchived, transferRosterOwnership, updatePlayer, updateRosterAccessRole, type HistoryEntry, type PlayerMatchHistoryEntry, type RosterSummary } from './lib/repository'
import { authErrorMessage } from './lib/authCallback'
import { signInWithGoogle, signOut, supabase } from './lib/supabase'
import { isAdmin } from './admin/api'
import { adminHash } from './admin/metrics'
import RosterAccessDialog from './views/RosterAccessDialog'
import InstallPrompt, { InstallAppButton } from './views/InstallPrompt'
import RosterSwitcher, { RosterNameDialog } from './views/RosterSwitcher'
import { PlayerStatistics } from './views/Statistics'

const SquadTab = lazy(() => import('./views/SquadTab'))
const HistoryTab = lazy(() => import('./views/HistoryTab'))
const LandingPage = lazy(() => import('./views/LandingPage'))
const AdminPage = lazy(() => import('./views/AdminPage'))

type Tab = 'squad' | 'match' | 'history'
type ThemePreference = 'system' | 'light' | 'dark'

const themeStorageKey = 'fulbo-parejo-theme-preference'
const fmt = (value: number) => value.toFixed(2)
const blankDraft = { name: '', baseRating: '60', preferredPosition: '', secondaryPosition: '', icon: playerIcons[0], color: playerColors[0] }
// U+FE0E prevents Safari on iPhone from rendering diagonal arrows as colored emoji.
const performanceSymbols: Record<PerformanceRating, string> = { '-2': '↓︎', '-1': '↘︎', 0: '−', 1: '↗︎', 2: '↑︎' }

function loadThemePreference(): ThemePreference {
  try {
    const value = window.localStorage.getItem(themeStorageKey)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch { return 'system' }
}

function ThemeSelector({ preference, onChange }: { preference: ThemePreference; onChange: (preference: ThemePreference) => void }) {
  const modes: readonly ThemePreference[] = ['system', 'light', 'dark']
  const labels = { system: 'Sistema', light: 'Claro', dark: 'Oscuro' }
  const next = modes[(modes.indexOf(preference) + 1) % modes.length]
  const icon = preference === 'light'
    ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" /></>
    : preference === 'dark'
    ? <path d="M20 15.2A8.4 8.4 0 0 1 8.8 4 8.4 8.4 0 1 0 20 15.2Z" />
    : <><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 22h8M12 19v3M8 9h8" /></>
  return <button type="button" className="header-icon-button theme-toggle" aria-label={`Cambiar apariencia. Modo actual: ${labels[preference]}. Siguiente: ${labels[next]}.`} title={`Modo ${labels[preference]}`} onClick={() => onChange(next)}><svg viewBox="0 0 24 24" aria-hidden="true">{icon}</svg></button>
}

function SystemHelpButton({ onOpen }: { onOpen: () => void }) {
  return <button type="button" className="header-icon-button system-help-button" aria-label="Abrir ayuda: cómo funciona Fulbo Parejo" aria-haspopup="dialog" title="Cómo funciona Fulbo Parejo" onClick={onOpen}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5m0-8.5h.01" /></svg></button>
}

function AdminDashboardButton({ onOpen }: { onOpen: () => void }) {
  return <button type="button" className="header-icon-button admin-dashboard-button" aria-label="Abrir dashboard de administración" title="Dashboard de administración" onClick={onOpen}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg></button>
}

function OffsetIndicator({ offset }: { offset: number | undefined }) {
  if (!offset) return null
  const positive = offset > 0
  return <small className={`rating-offset ${positive ? 'positive-offset' : 'negative-offset'}`} aria-label={`${positive ? 'Subió' : 'Bajó'} ${Math.abs(offset).toFixed(2)} puntos`}>{positive ? '↑' : '↓'} {positive ? '+' : ''}{fmt(offset)}</small>
}

function RosterSwitchConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return <div className="modal-backdrop"><section className="result-modal roster-switch-confirm" role="alertdialog" aria-modal="true" aria-labelledby="roster-switch-confirm-title"><p className="eyebrow">CAMBIAR PLANTEL</p><h2 id="roster-switch-confirm-title">¿Descartar lo que estás preparando?</h2><p>La convocatoria, los equipos y los cambios sin guardar no se conservarán.</p><div className="modal-actions"><button type="button" className="cancel-button" onClick={onCancel}>Seguir editando</button><button type="button" className="save-player" onClick={onConfirm}>Cambiar plantel</button></div></section></div>
}

function TabLoader({ label = 'Cargando…', panel = false }: { label?: string; panel?: boolean }) {
  return <section className={`${panel ? 'panel ' : ''}tab-loader`} role="status" aria-live="polite"><span aria-hidden="true">⚽</span><p>{label}</p></section>
}

function NoticeToast({ message, onClose, actionLabel, onAction, actionDisabled = false }: { message: string; onClose: () => void; actionLabel?: string; onAction?: () => void; actionDisabled?: boolean }) {
  return <aside className="notice-toast" role="status" aria-live="polite"><span className="notice-toast-icon" aria-hidden="true">✦</span><p>{message}</p>{actionLabel && onAction && <button type="button" className="notice-toast-action" disabled={actionDisabled} onClick={onAction}>{actionLabel}</button>}<button type="button" aria-label="Cerrar notificación" onClick={onClose}>×</button></aside>
}

function MatchmakingExplanationDialog({ proposal, onClose }: { proposal: MatchProposal; onClose: () => void }) {
  const explanation = describeMatchProposal(proposal)
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section className="result-modal matchmaking-explanation-modal" role="dialog" aria-modal="true" aria-labelledby="matchmaking-explanation-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="form-heading"><div><p className="eyebrow">ARMADO</p><h2 id="matchmaking-explanation-title">Por qué quedaron parejos</h2></div><button type="button" aria-label="Cerrar" onClick={onClose}>×</button></div>
      <p className="matchmaking-explanation-summary">{explanation.summary}</p>
      <details className="matchmaking-explanation-criteria"><summary>Ver criterios</summary><ul>{explanation.criteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul></details>
      <button type="button" className="save-player" onClick={onClose}>Entendido</button>
    </section>
  </div>
}

function ArchivePlayerDialog({ player, saving, onClose, onConfirm }: { player: Player; saving: boolean; onClose: () => void; onConfirm: () => void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section className="result-modal archive-dialog" role="alertdialog" aria-modal="true" aria-labelledby="archive-player-title" aria-describedby="archive-player-description" onMouseDown={(event) => event.stopPropagation()}>
      <p className="eyebrow">PAPELERA</p><h2 id="archive-player-title">¿Enviar a {player.name} a la papelera?</h2><p id="archive-player-description">Dejará de aparecer en las convocatorias. Podés restaurarlo cuando quieras.</p>
      <div className="modal-actions"><button type="button" className="cancel-button" autoFocus disabled={saving} onClick={onClose}>Cancelar</button><button type="button" className="save-player" disabled={saving} onClick={onConfirm}>{saving ? 'Archivando…' : 'Enviar a la papelera'}</button></div>
    </section>
  </div>
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
      <div className="field-label">
        <div className="field-label-title"><label htmlFor="initial-rating">⭐ Media inicial (0 a 100)</label><details className="rating-help"><summary aria-label="Ver ayuda sobre la media inicial">i</summary><small id="initial-rating-help">Cargá una estimación del nivel actual. Es el punto de partida: después de los partidos, la media aprendida puede subir o bajar incluso fuera de este rango.</small></details></div>
        <input
          id="initial-rating"
          type="number"
          min="0"
          max="100"
          step="1"
          aria-describedby="initial-rating-help"
          value={draft.baseRating}
          onChange={(event) => onChange({ ...draft, baseRating: event.target.value })}
        />
      </div>
      <fieldset className="picker-field"><legend>⚽ Posición primaria</legend><div className="position-picker" role="group" aria-label="Posición primaria"><button type="button" className={!draft.preferredPosition ? 'selected' : ''} aria-pressed={!draft.preferredPosition} onClick={() => onChange({ ...draft, preferredPosition: '', secondaryPosition: '' })}>Sin posición</button>{positions.map((position) => <button type="button" className={draft.preferredPosition === position ? 'selected' : ''} aria-label={`Usar ${position}: ${positionLabel[position]}`} aria-pressed={draft.preferredPosition === position} key={position} onClick={() => onChange({ ...draft, preferredPosition: position, secondaryPosition: draft.secondaryPosition === position ? '' : draft.secondaryPosition })}><strong>{position}</strong><span>{positionLabel[position]}</span></button>)}</div></fieldset>
      {draft.preferredPosition && <fieldset className="picker-field"><legend>↔ Posición secundaria <small>opcional</small></legend><div className="position-picker" role="group" aria-label="Posición secundaria"><button type="button" className={!draft.secondaryPosition ? 'selected' : ''} aria-pressed={!draft.secondaryPosition} onClick={() => onChange({ ...draft, secondaryPosition: '' })}>Sin posición secundaria</button>{positions.filter((position) => position !== draft.preferredPosition).map((position) => <button type="button" className={draft.secondaryPosition === position ? 'selected' : ''} aria-label={`Usar ${position}: ${positionLabel[position]} como posición secundaria`} aria-pressed={draft.secondaryPosition === position} key={position} onClick={() => onChange({ ...draft, secondaryPosition: position })}><strong>{position}</strong><span>{positionLabel[position]}</span></button>)}</div></fieldset>}
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
      <fieldset className="performance-field"><legend>⭐ ¿Cómo jugó cada uno?</legend><p>Normal está seleccionado por defecto.</p><div className="performance-list">{participants.map((player) => { const rating = performanceRatings.get(player.id) ?? 0; return <div className="performance-player" key={player.id}><span style={{ backgroundColor: player.color }}>{player.icon}</span><div className="performance-name"><strong>{player.name}</strong><small>{performanceLevels.find((level) => level.value === rating)!.label}</small></div><div className="performance-options" role="group" aria-label={`Cómo jugó ${player.name}`}>{performanceLevels.map(({ value, label }) => <button type="button" aria-label={`${player.name}: ${label}`} aria-pressed={rating === value} className={`performance-option performance-${value + 2}${rating === value ? ' selected' : ''}`} key={value} title={label} onClick={() => onPerformanceChange(player.id, value)}>{performanceSymbols[value]}</button>)}</div></div>})}</div></fieldset>
      <div className="modal-actions"><button type="button" className="cancel-button" onClick={onClose}>Cancelar</button><button className="save-player" disabled={saving} onClick={onSave}>Guardar resultado ✓</button></div>
    </section>
  </div>
}

function PlayerDetail({ player, players, history, chemistryPairs, loading, error, onClose }: { player: Player; players: Player[]; history: PlayerMatchHistoryEntry[]; chemistryPairs: ChemistryPair[]; loading: boolean; error: string | null; onClose: () => void }) {
  const performanceLabel = (rating: PerformanceRating) => performanceLevels.find((level) => level.value === rating)!.label
  const [detailTab, setDetailTab] = useState<'history' | 'chemistry'>('history')
  useEffect(() => setDetailTab('history'), [player.id])
  const chemistry = chemistryPairs.flatMap((pair) => {
    const teammateId = pair.playerIds[0] === player.id ? pair.playerIds[1] : pair.playerIds[1] === player.id ? pair.playerIds[0] : null
    const teammate = teammateId ? players.find((entry) => entry.id === teammateId) : undefined
    return teammate ? [{ ...pair, teammate }] : []
  })
  const { strongest: strongestChemistry, weakest: weakestChemistry } = chemistryExtremes(chemistry)
  const chemistryList = (entries: typeof chemistry, emptyMessage = 'Todavía no compartió equipo con otro jugador.') => entries.length ? <ol>{entries.map(({ teammate, score, matches }) => <li key={teammate.id}><div className="chemistry-player"><span style={{ backgroundColor: teammate.color }}>{teammate.icon}</span><div><strong>{teammate.name}</strong><small>{matches} {matches === 1 ? 'partido' : 'partidos'} juntos{matches < 4 ? ' · Poca evidencia' : ''}</small></div></div><strong className={`chemistry-score ${score > 0 ? 'positive-offset' : score < 0 ? 'negative-offset' : ''}`}>{score > 0 ? '+' : ''}{fmt(score)}</strong></li>)}</ol> : <p className="muted">{emptyMessage}</p>
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section className="result-modal player-detail-modal" role="dialog" aria-modal="true" aria-labelledby="player-detail-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="form-heading"><div><p className="eyebrow">FICHA DEL JUGADOR</p><h2 id="player-detail-title">{player.name}</h2></div><button type="button" aria-label="Cerrar" onClick={onClose}>×</button></div>
      <div className="player-detail-summary"><span style={{ backgroundColor: player.color }}>{player.icon}</span><div><strong>{fmt(operationalRating(player))}</strong><small>media operativa</small></div><div><strong>{history.length}</strong><small>partidos</small></div></div>
      <PlayerStatistics history={history} loading={loading} />
      <div className="player-detail-tabs" role="tablist" aria-label="Datos del jugador"><button type="button" role="tab" aria-selected={detailTab === 'history'} aria-controls="player-detail-history" className={detailTab === 'history' ? 'selected' : ''} onClick={() => setDetailTab('history')}>Historial</button><button type="button" role="tab" aria-selected={detailTab === 'chemistry'} aria-controls="player-detail-chemistry" className={detailTab === 'chemistry' ? 'selected' : ''} onClick={() => setDetailTab('chemistry')}>Química</button></div>
      {detailTab === 'history' ? <div id="player-detail-history" className="player-detail-history" role="tabpanel"><h3>Partidos jugados</h3>{loading ? <p className="muted">Cargando partidos…</p> : error ? <p className="detail-error">{error}</p> : history.length ? <ol>{history.map((entry) => <li key={entry.id}><div><strong>{new Date(entry.createdAt).toLocaleDateString('es-AR')} · {entry.result === 'win' ? 'Ganó' : entry.result === 'loss' ? 'Perdió' : 'Empató'}</strong><small>{entry.goalDifference === null ? 'Sin diferencia de goles' : `Diferencia de goles: ${entry.goalDifference}`}</small></div><div className="player-match-metrics"><small className={`performance-badge performance-${entry.performanceRating + 2}`}>{performanceLabel(entry.performanceRating)}</small><small className={`rating-offset ${entry.offset > 0 ? 'positive-offset' : entry.offset < 0 ? 'negative-offset' : ''}`}>{entry.offset > 0 ? '+' : ''}{fmt(entry.offset)}</small></div></li>)}</ol> : <p className="muted">Todavía no jugó partidos registrados.</p>}</div> : <div id="player-detail-chemistry" className="player-detail-chemistry" role="tabpanel"><p className="muted">Se calcula según los partidos compartidos en el mismo equipo.</p><section><h3>Más química</h3>{chemistryList(strongestChemistry)}</section><section><h3>Menos química</h3>{chemistryList(weakestChemistry, 'Todas las duplas ya aparecen en Más química.')}</section></div>}
    </section>
  </div>
}

function RatingInfo({ onClose }: { onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section className="result-modal rating-info-modal" role="dialog" aria-modal="true" aria-labelledby="rating-info-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="form-heading"><div><p className="eyebrow">GUÍA DEL SISTEMA</p><h2 id="rating-info-title">Cómo funciona Fulbo Parejo</h2></div><button type="button" aria-label="Cerrar" onClick={onClose}>×</button></div>
      <div className="rating-info-content">
        <section>
          <h3>La media que usa la app</h3>
          <p><strong>Media inicial:</strong> la que cargás manualmente para cada jugador, entre 0 y 100. Es un punto de partida, no un techo. <strong>Media aprendida:</strong> se actualiza después de cada partido y puede subir o bajar incluso fuera de ese rango.</p>
          <p><strong>Media operativa:</strong> es la que usa Nuevo partido para equilibrar los equipos.</p>
          <p className="rating-formula">40% media base + 60% media aprendida</p>
        </section>
        <section><h3>Cómo se arman los equipos</h3><p>La app divide a los convocados en dos equipos de la misma cantidad y busca reducir al mínimo la diferencia entre sus medias operativas.</p><p><strong>Posiciones y arqueros:</strong> se tienen en cuenta como un ajuste suave. La posición primaria tiene prioridad; la secundaria aporta cobertura cuando ayuda a equilibrar. Si hay dos o más PO, intenta dejar uno por equipo, priorizando los PO primarios y usando los secundarios sólo como respaldo. Las demás posiciones ayudan a repartir líneas y puestos, pero no son una formación obligatoria.</p><p><strong>Cantidad impar:</strong> prueba dejar fuera a cada convocado y elige al no asignado que permite el armado más equilibrado. No aplica rotación automática.</p></section>
        <section><h3>Cómo funciona el Elo</h3><p>Antes del partido se comparan las medias operativas promedio de ambos equipos. Ganarle a un equipo que era favorito suma más; perder contra uno más fuerte resta menos.</p><p>El empate también modifica las medias: el equipo que llegaba como menos favorito puede subir y el favorito bajar.</p><p><strong>Diferencia de goles:</strong> una victoria más amplia aumenta el cambio de Elo de forma gradual, con un tope para que una goleada no descontrole las medias.</p></section>
        <section><h3>Cómo jugó cada uno</h3><p>Al registrar el resultado, la valoración individual ajusta solamente el cambio de Elo de ese jugador en ese partido.</p><ul className="performance-explanation"><li><strong>Muy mal:</strong> 50% de lo que suma o 150% de lo que resta.</li><li><strong>Mal:</strong> 75% de lo que suma o 125% de lo que resta.</li><li><strong>Normal:</strong> 100% del cambio.</li><li><strong>Bien:</strong> 125% de lo que suma o 75% de lo que resta.</li><li><strong>Muy bien:</strong> 150% de lo que suma o 50% de lo que resta.</li></ul><p>Por eso, jugar <strong>muy bien</strong> potencia una victoria y amortigua una derrota; jugar <strong>muy mal</strong> hace lo contrario.</p></section>
        <section><h3>Química de los equipos</h3><p>La app aprende qué jugadores rinden mejor juntos según los partidos que compartieron en el mismo equipo.</p><p>Una victoria suma química, un empate suma menos y una derrota resta. Cuantos más partidos compartan, más confiable será esa señal.</p><p>Al armar equipos, la química sólo ajusta de forma gradual el equilibrio de medias y posiciones: busca juntar duplas que funcionan y separar las que vienen rindiendo peor.</p></section>
        <section><h3>Pizarra e intercambios</h3><p>La pizarra muestra a cada equipo sobre la cancha según la posición primaria de sus jugadores. Es sólo una representación visual: no cambia el armado, las medias ni el resultado.</p><p>El botón ↔ propone un cambio con un rival de posición o línea comparable y de media cercana, priorizando coincidencias de posición primaria. En modo custom, podés elegir libremente un jugador de cada equipo para intercambiarlos; después el cambio de medias se muestra, pero no se rebalancea de forma automática.</p></section>
        <section><h3>Historial y correcciones</h3><p>Podés editar o borrar un resultado desde Historial. La app recalcula las medias aprendidas recorriendo los partidos guardados, para que el plantel refleje la corrección sin perder el resto del historial.</p></section>
        <a className="mayofy-credit" href="https://mayofy.vercel.app" target="_blank" rel="noopener noreferrer"><span>Fulbo Parejo está desarrollado por</span><img src="https://mayofy.vercel.app/_next/image?url=%2Fimages%2Fmayofy-wordmark.png&w=3840&q=70" alt="Mayofy" /></a>
      </div>
      <button type="button" className="save-player" onClick={onClose}>Entendido</button>
    </section>
  </div>
}

const pitchLayout: Record<Position, { left: number; top: number }> = {
  PO: { left: 50, top: 90 },
  DFI: { left: 18, top: 68 }, DFC: { left: 50, top: 68 }, DFD: { left: 82, top: 68 },
  MI: { left: 18, top: 46 }, MC: { left: 50, top: 46 }, MD: { left: 82, top: 46 },
  EI: { left: 18, top: 24 }, DC: { left: 50, top: 24 }, ED: { left: 82, top: 24 },
}

function pitchCoordinates(player: Player, players: Player[]) {
  const layout = player.preferredPosition ? pitchLayout[player.preferredPosition] : { left: 50, top: 50 }
  const matching = players.filter((entry) => entry.preferredPosition === player.preferredPosition)
  const offset = (matching.findIndex((entry) => entry.id === player.id) - (matching.length - 1) / 2) * 14
  return { left: Math.min(90, Math.max(10, layout.left + offset)), top: layout.top }
}

function Pitch({ team }: { team: Team }) {
  const players = [...team.players].sort((a, b) => Number(isGoalkeeper(b.preferredPosition)) - Number(isGoalkeeper(a.preferredPosition)))
  return <div className="pitch" aria-label={`Cancha ${team.name}`}><span className="centre-circle" />{players.map((player) => {
    const coordinate = pitchCoordinates(player, players)
    return <div className="pitch-player" key={player.id} style={{ left: `${coordinate.left}%`, top: `${coordinate.top}%` }} title={player.name}><span style={{ backgroundColor: player.color }}>{player.icon}</span><small>{player.name}</small></div>
  })}</div>
}

function downloadJson(players: Player[]) {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), players }, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'fulbo-matchmaking.json'; anchor.click(); URL.revokeObjectURL(url)
}

async function shareMatch(teamOne: Team, teamTwo: Team, latestOffsets: ReadonlyMap<string, number>, rosterName: string | undefined) {
  const rosterTop = 196
  const rosterHeight = Math.max(teamOne.players.length, teamTwo.players.length) * 40
  const pitchTop = 350 + rosterHeight
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = pitchTop + 760
  const context = canvas.getContext('2d')!
  context.fillStyle = '#102e22'; context.fillRect(0, 0, canvas.width, canvas.height)
  context.font = '900 58px Archivo Black, system-ui'
  const fulboWidth = context.measureText('Fulbo').width; const parejoWidth = context.measureText('Parejo').width; const wordmarkLeft = 540 - (fulboWidth + parejoWidth) / 2
  context.textAlign = 'left'; context.fillStyle = '#fff5d6'; context.fillText('Fulbo', wordmarkLeft, 80); context.fillStyle = '#ef4444'; context.fillText('Parejo', wordmarkLeft + fulboWidth, 80)
  if (rosterName) { context.fillStyle = '#c9d7bf'; context.font = '700 24px Manrope, system-ui'; context.textAlign = 'center'; context.fillText(rosterName, 540, 120) }
  const drawPitch = (team: Team, left: number, accent: string) => {
    const top = pitchTop; const size = 400
    context.fillStyle = '#20744b'; context.fillRect(left, top, size, 690)
    context.fillStyle = '#1a6741'; for (let stripe = 0; stripe < 8; stripe += 2) context.fillRect(left + stripe * 50, top, 50, 690)
    context.strokeStyle = '#d9f2c3'; context.lineWidth = 7; context.strokeRect(left + 8, top + 8, size - 16, 674); context.beginPath(); context.moveTo(left, top + 345); context.lineTo(left + size, top + 345); context.stroke(); context.beginPath(); context.arc(left + 200, top + 345, 60, 0, Math.PI * 2); context.stroke()
    context.fillStyle = accent; context.fillRect(left, pitchTop - 78, size, 54); context.fillStyle = '#172018'; context.font = '900 28px Manrope, system-ui'; context.fillText(`${team.name} · ${fmt(team.operationalRating / team.players.length)}`, left + 200, pitchTop - 41)
    const players = [...team.players].sort((a, b) => Number(isGoalkeeper(b.preferredPosition)) - Number(isGoalkeeper(a.preferredPosition)))
    players.forEach((player) => {
      const coordinate = pitchCoordinates(player, players)
      const x = left + (coordinate.left / 100) * size; const y = top + (coordinate.top / 100) * 690
      context.fillStyle = player.color; context.beginPath(); context.arc(x, y, 27, 0, Math.PI * 2); context.fill(); context.strokeStyle = '#fffbed'; context.lineWidth = 4; context.stroke()
      context.fillStyle = '#172018'; context.font = '22px system-ui'; context.fillText(player.icon, x, y + 8)
      context.fillStyle = '#fffbed'; context.font = '800 16px Manrope, system-ui'; context.fillText(player.name, x, y - 39)
    })
  }
  const drawRoster = (team: Team, left: number, accent: string) => {
    context.fillStyle = accent; context.fillRect(left - 16, rosterTop - 24, 7, rosterHeight + 12)
    context.textAlign = 'left'; context.fillStyle = '#fff5d6'; context.font = '800 26px Manrope, system-ui'
    team.players.forEach((player, index) => {
      const y = rosterTop + index * 40; const label = `• ${player.name}`
      context.fillStyle = '#fff5d6'; context.fillText(label, left, y)
      const movement = formatShareMovement(latestOffsets.get(player.id))
      if (movement) { context.fillStyle = movement.color; context.fillText(movement.text, left + context.measureText(label).width + 14, y) }
    })
    context.textAlign = 'center'
  }
  drawRoster(teamOne, 70, '#ffb36e'); drawRoster(teamTwo, 610, '#9dc4ff')
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
  const [themePreference, setThemePreference] = useState<ThemePreference>(loadThemePreference)
  const [sessionReady, setSessionReady] = useState(!configured)
  const [userId, setUserId] = useState<string | null>(null)
  const [adminRoute, setAdminRoute] = useState(() => adminHash())
  const [adminAvailable, setAdminAvailable] = useState(false)
  const [rosterLoading, setRosterLoading] = useState(configured)
  const [rosterId, setRosterId] = useState<string | null>(null)
  const [rosters, setRosters] = useState<RosterSummary[]>([])
  const [rosterSetupOpen, setRosterSetupOpen] = useState(false)
  const [rosterSwitchTarget, setRosterSwitchTarget] = useState<string | null>(null)
  const [rosterSaving, setRosterSaving] = useState(false)
  const [rosterRole, setRosterRole] = useState<RosterRole | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [latestOffsets, setLatestOffsets] = useState(new Map<string, number>())
  const [chemistry, setChemistry] = useState<PairChemistry>(new Map())
  const [chemistryWithEvidence, setChemistryWithEvidence] = useState<PairChemistry>(new Map())
  const [chemistryPairs, setChemistryPairs] = useState<ChemistryPair[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [proposal, setProposal] = useState<MatchProposal | null>(null)
  const [balancedProposal, setBalancedProposal] = useState<MatchProposal | null>(null)
  const [customMode, setCustomMode] = useState(false)
  const [manualSelection, setManualSelection] = useState<{ playerId: string; team: 'teamOne' | 'teamTwo' } | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyHasMore, setHistoryHasMore] = useState(false)
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false)
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
  const authenticatedUserId = useRef<string | null>(null)
  const [ratingInfoOpen, setRatingInfoOpen] = useState(false)
  const [matchmakingExplanationOpen, setMatchmakingExplanationOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [rosterAccessOpen, setRosterAccessOpen] = useState(false)
  const [rosterAccessEntries, setRosterAccessEntries] = useState<RosterAccessEntry[]>([])
  const [rosterAccessLoading, setRosterAccessLoading] = useState(false)
  const [rosterAccessLoadError, setRosterAccessLoadError] = useState<string | null>(null)
  const [invitationError, setInvitationError] = useState<string | null>(null)
  const [invitationLoading, setInvitationLoading] = useState(false)
  const [rosterAccessActionUserId, setRosterAccessActionUserId] = useState<string | null>(null)
  const [archiveCandidate, setArchiveCandidate] = useState<Player | null>(null)
  const [archiveNotice, setArchiveNotice] = useState<Player | null>(null)
  const [archivingPlayerId, setArchivingPlayerId] = useState<string | null>(null)
  const [installPromptOpen, setInstallPromptOpen] = useState(false)
  const [installReminderReady, setInstallReminderReady] = useState(false)
  const inviteButtonRef = useRef<HTMLButtonElement | null>(null)
  const rosterAccessRequest = useRef(0)
  const invitationRequestInFlight = useRef(false)

  useEffect(() => {
    if (!message) return
    const timeout = window.setTimeout(() => setMessage(null), 5000)
    return () => window.clearTimeout(timeout)
  }, [message])

  useEffect(() => {
    if (!archiveNotice) return
    const timeout = window.setTimeout(() => setArchiveNotice(null), 10000)
    return () => window.clearTimeout(timeout)
  }, [archiveNotice])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      const theme = themePreference === 'system' ? (media.matches ? 'dark' : 'light') : themePreference
      document.documentElement.dataset.theme = theme
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0c1510' : '#0d4c36')
    }
    applyTheme()
    if (themePreference === 'system') media.addEventListener('change', applyTheme)
    return () => media.removeEventListener('change', applyTheme)
  }, [themePreference])

  const changeThemePreference = (preference: ThemePreference) => {
    try {
      if (preference === 'system') window.localStorage.removeItem(themeStorageKey)
      else window.localStorage.setItem(themeStorageKey, preference)
    } catch { /* The selected theme still applies for this session. */ }
    setThemePreference(preference)
  }

  useEffect(() => {
    const db = supabase
    if (!db) return
    let live = true
    const sync = (id: string | null) => {
      if (!live) return
      if (authenticatedUserId.current !== id) setRosterLoading(Boolean(id))
      authenticatedUserId.current = id
      setUserId(id)
      setSessionReady(true)
    }
    db.auth.getSession().then(({ data }) => sync(data.session?.user.id ?? null))
    const { data: listener } = db.auth.onAuthStateChange((_event, session) => sync(session?.user.id ?? null))
    return () => { live = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    const syncRoute = () => setAdminRoute(adminHash())
    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  useEffect(() => {
    if (!userId) { setAdminAvailable(false); return }
    let live = true
    void isAdmin().then((allowed) => { if (live) setAdminAvailable(allowed) }).catch(() => { if (live) setAdminAvailable(false) })
    return () => { live = false }
  }, [userId])

  useEffect(() => {
    const error = authErrorMessage()
    if (error) setMessage(`No se pudo iniciar sesión: ${error}`)
  }, [])

  useEffect(() => {
    const db = supabase
    if (!db || !userId || adminRoute) return
    let live = true
    const initializeRoster = async () => {
      setRosterLoading(true)
      try {
        const token = new URLSearchParams(window.location.search).get('invite')
        const id = token ? await acceptRosterInvitation(token) : null
        const [accessibleRosters, preferredId] = await Promise.all([loadAccessibleRosters(), id ? Promise.resolve(id) : loadActiveRosterId(userId)])
        if (token) window.history.replaceState({}, '', window.location.pathname)
        const activeId = accessibleRosters.some((roster) => roster.id === preferredId) ? preferredId! : accessibleRosters[0]?.id ?? null
        if (live) {
          setRosters(accessibleRosters)
          setRosterId(activeId)
          setRosterSetupOpen(!activeId)
          if (id) { setMessage('Te sumaste al plantel compartido.'); void saveActiveRosterId(userId, id) }
        }
      } catch (error) { if (live) setMessage(error instanceof Error ? error.message : 'No se pudo cargar tu plantel.') }
      finally { if (live) setRosterLoading(false) }
    }
    void initializeRoster()
    return () => { live = false }
  }, [userId, adminRoute])

  useEffect(() => {
    const db = supabase
    if (!db || !userId || !rosterId) return
    let live = true
    const load = async () => {
      setRosterLoading(true)
      try {
        const [loadedPlayers, loadedHistory, loadedOffsets, loadedChemistry, role] = await Promise.all([loadPlayers(rosterId), loadHistory(rosterId), loadLatestPlayerOffsets(rosterId), loadChemistryHistory(rosterId), loadRosterRole(rosterId, userId)])
        if (live) {
          setRosterRole(role); setPlayers(loadedPlayers); setLatestOffsets(loadedOffsets); setChemistry(chemistryFromHistory(loadedChemistry)); setChemistryWithEvidence(chemistryWithSufficientEvidence(loadedChemistry)); setChemistryPairs(chemistryPairsFromHistory(loadedChemistry)); setSelected(new Set()); setProposal(null); setBalancedProposal(null); setCustomMode(false); setManualSelection(null); setHistory(loadedHistory.entries); setHistoryHasMore(loadedHistory.hasMore)
        }
      } catch (error) { if (live) setMessage(error instanceof Error ? error.message : 'No se pudo cargar tu plantel.') }
      finally { if (live) setRosterLoading(false) }
    }
    void load()
    return () => { live = false }
  }, [rosterId, userId])

  const { activePlayers: active, archivedPlayers } = partitionPlayers(players)
  const selectedPlayers = players.filter((player) => selected.has(player.id) && !player.archived)
  const activeRosterName = rosters.find((roster) => roster.id === rosterId)?.name
  const mean = (team: Team) => team.operationalRating / team.players.length
  const discardProposal = () => { setProposal(null); setBalancedProposal(null); setCustomMode(false); setManualSelection(null); setPendingResult(null); setGoalDifference(''); setPerformanceRatings(new Map()); setMatchmakingExplanationOpen(false) }
  const selectRoster = (nextRosterId: string) => {
    if (nextRosterId === rosterId) return
    discardProposal(); setSelected(new Set()); setPlayers([]); setHistory([]); setHistoryHasMore(false); setChemistryPairs([]); setEditorOpen(false); setEditingPlayer(null); setEditingHistory(null); setArchiveCandidate(null); setRosterRole(null); closePlayerDetail(); setRosterId(nextRosterId)
    if (userId) void saveActiveRosterId(userId, nextRosterId).catch(() => setMessage('No pudimos recordar este plantel para tu próximo ingreso.'))
  }
  const hasUnsavedRosterWork = selected.size > 0 || Boolean(proposal || editorOpen || pendingResult || editingHistory)
  const requestRosterSelect = (nextRosterId: string) => {
    if (nextRosterId === rosterId) return
    if (hasUnsavedRosterWork) { setRosterSwitchTarget(nextRosterId); return }
    selectRoster(nextRosterId)
  }
  const saveRoster = async (name: string) => {
    if (!userId) return
    setRosterSaving(true)
    try {
      const roster = await createRoster(userId, name)
      setRosters((current) => [...current, roster])
      setRosterSetupOpen(false)
      requestRosterSelect(roster.id)
      if (rosters.length === 0) setInstallReminderReady(true)
      setMessage(`“${roster.name}” está listo para cargar jugadores.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo crear el plantel.'
      setMessage(message)
      throw new Error(message)
    }
    finally { setRosterSaving(false) }
  }
  const saveRosterName = async (name: string) => {
    if (!rosterId) return
    setRosterSaving(true)
    try {
      const roster = await renameRoster(rosterId, name)
      setRosters((current) => current.map((entry) => entry.id === roster.id ? roster : entry))
      setMessage('Nombre del plantel actualizado.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo renombrar el plantel.'
      setMessage(message)
      throw new Error(message)
    }
    finally { setRosterSaving(false) }
  }
  const makeTeams = () => { if (!canPlanMatch(rosterRole)) return; try { const next = createMatchProposal(selectedPlayers, chemistry, chemistryWithEvidence); setProposal(next); setBalancedProposal(next); setCustomMode(false); setManualSelection(null); setMatchmakingExplanationOpen(false) } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo armar el partido.') } }
  const swapDirectly = (oneId: string, twoId: string) => {
    if (!proposal) return
    const teamOnePlayers = proposal.teamOne.players.map((player) => player.id === oneId ? proposal.teamTwo.players.find((entry) => entry.id === twoId)! : player)
    const teamTwoPlayers = proposal.teamTwo.players.map((player) => player.id === twoId ? proposal.teamOne.players.find((entry) => entry.id === oneId)! : player)
    const teamOne = { ...proposal.teamOne, players: teamOnePlayers, operationalRating: teamOnePlayers.reduce((sum, entry) => sum + operationalRating(entry), 0) }
    const teamTwo = { ...proposal.teamTwo, players: teamTwoPlayers, operationalRating: teamTwoPlayers.reduce((sum, entry) => sum + operationalRating(entry), 0) }
    setProposal({ ...proposal, teamOne, teamTwo, balanceGap: Math.abs(teamOne.operationalRating - teamTwo.operationalRating), positionAdjustmentChangedResult: false, chemistryChangedResult: false, unassignedPreservesBalance: false })
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
    const counterpart = findComparableSwap(player, origin.players, destination.players)
    if (!counterpart) { setMessage(`No hay un cambio compatible para ${player.name}.`); return }
    const nextOrigin = origin.players.map((entry) => entry.id === player.id ? counterpart : entry)
    const nextDestination = destination.players.map((entry) => entry.id === counterpart.id ? player : entry)
    const teamOnePlayers = source === 'teamOne' ? nextOrigin : nextDestination
    const teamTwoPlayers = source === 'teamOne' ? nextDestination : nextOrigin
    const teamOne = { ...proposal.teamOne, players: teamOnePlayers, operationalRating: teamOnePlayers.reduce((sum, entry) => sum + operationalRating(entry), 0) }
    const teamTwo = { ...proposal.teamTwo, players: teamTwoPlayers, operationalRating: teamTwoPlayers.reduce((sum, entry) => sum + operationalRating(entry), 0) }
    setProposal({ ...proposal, teamOne, teamTwo, balanceGap: Math.abs(teamOne.operationalRating - teamTwo.operationalRating), positionAdjustmentChangedResult: false, chemistryChangedResult: false, unassignedPreservesBalance: false })
    setMessage(`🔄 ${player.name} cambió por ${counterpart.name}.`)
  }
  const openPlayerEditor = (player?: Player) => { if (!canEditRoster(rosterRole)) return
    setEditingPlayer(player ?? null)
    setDraft(player ? { name: player.name, baseRating: String(player.baseRating), preferredPosition: player.preferredPosition ?? '', secondaryPosition: player.secondaryPosition ?? '', icon: player.icon, color: player.color } : blankDraft)
    setEditorOpen(true)
  }
  const openResultEditor = (result: RecordedResult) => { if (!canEditRoster(rosterRole)) return
    if (!proposal) return
    setPerformanceRatings(new Map([...proposal.teamOne.players, ...proposal.teamTwo.players].map((player) => [player.id, 0] as const)))
    setPendingResult(result)
  }
  const closeResultEditor = () => { setPendingResult(null); setGoalDifference(''); setPerformanceRatings(new Map()) }
  const openHistoryEditor = (entry: HistoryEntry) => { if (!canEditRoster(rosterRole)) return
    setEditingHistory(entry)
    setHistoryResult(entry.outcome === 'team_one' ? 'teamOne' : entry.outcome === 'team_two' ? 'teamTwo' : 'draw')
    setGoalDifference(entry.goalDifference === null ? '' : String(entry.goalDifference))
    setPerformanceRatings(new Map(entry.playerOffsets.map(({ playerId, performanceRating }) => [playerId, performanceRating] as const)))
  }
  const closeHistoryEditor = () => { setEditingHistory(null); setGoalDifference(''); setPerformanceRatings(new Map()) }
  const setPlayerPerformance = (playerId: string, rating: PerformanceRating) => setPerformanceRatings((current) => new Map(current).set(playerId, rating))
  const loadMoreHistory = async () => {
    if (!rosterId || historyLoadingMore || !historyHasMore) return
    setHistoryLoadingMore(true)
    try {
      const page = await loadHistory(rosterId, history.length)
      setHistory((current) => [...current, ...page.entries.filter((entry) => !current.some((currentEntry) => currentEntry.id === entry.id))])
      setHistoryHasMore(page.hasMore)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudieron cargar los partidos anteriores.') }
    finally { setHistoryLoadingMore(false) }
  }
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
    event.preventDefault(); if (!canEditRoster(rosterRole) || !rosterId || !draft.name.trim()) return
    const rating = parseInitialRating(draft.baseRating)
    if (rating === null) { setMessage(initialRatingValidationMessage); return }
    setSaving(true)
    try {
      const resetLearning = Boolean(editingPlayer && editingPlayer.baseRating !== rating)
      const attributes = { name: draft.name, baseRating: rating, learnedRating: resetLearning ? rating : editingPlayer?.learnedRating ?? rating, eloSeed: resetLearning ? rating : editingPlayer?.eloSeed ?? rating, preferredPosition: (draft.preferredPosition || undefined) as Position | undefined, secondaryPosition: (draft.secondaryPosition || undefined) as Position | undefined, icon: draft.icon, color: draft.color }
      const player = editingPlayer ? await updatePlayer(editingPlayer.id, attributes) : await createPlayer(rosterId, attributes)
      setPlayers((current) => editingPlayer ? current.map((entry) => entry.id === player.id ? player : entry) : [...current, player])
      discardProposal(); setEditorOpen(false); setEditingPlayer(null); setDraft(blankDraft); if (resetLearning) setMessage('Media base actualizada: se reinició el aprendizaje para mantener el historial consistente.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo guardar el jugador.') } finally { setSaving(false) }
  }
  const archive = async () => {
    if (!canEditRoster(rosterRole) || !archiveCandidate) return
    const player = archiveCandidate
    const wasSelected = selected.has(player.id)
    setArchiveCandidate(null); setArchivingPlayerId(player.id)
    setPlayers((current) => current.map((entry) => entry.id === player.id ? { ...entry, archived: true } : entry))
    setSelected((current) => { const next = new Set(current); next.delete(player.id); return next })
    try {
      await setArchived(player.id, true)
      discardProposal()
      setArchiveNotice(player)
    } catch (error) {
      setPlayers((current) => current.map((entry) => entry.id === player.id ? { ...entry, archived: false } : entry))
      if (wasSelected) setSelected((current) => new Set(current).add(player.id))
      setMessage(error instanceof Error ? error.message : 'No se pudo archivar el jugador. Revisá tu conexión e intentá de nuevo.')
    } finally { setArchivingPlayerId(null) }
  }
  const restore = async (player: Player) => {
    if (!canEditRoster(rosterRole)) return; setArchivingPlayerId(player.id)
    setPlayers((current) => current.map((entry) => entry.id === player.id ? { ...entry, archived: false } : entry))
    try {
      await setArchived(player.id, false)
      if (archiveNotice?.id === player.id) setArchiveNotice(null)
      setMessage(`${player.name} volvió al plantel.`)
    } catch (error) {
      setPlayers((current) => current.map((entry) => entry.id === player.id ? { ...entry, archived: true } : entry))
      if (archiveNotice?.id === player.id) setArchiveNotice(null)
      setMessage(error instanceof Error ? error.message : 'No se pudo restaurar el jugador. Revisá tu conexión e intentá de nuevo.')
    } finally { setArchivingPlayerId(null) }
  }
  const record = async (result: RecordedResult) => {
    if (!canEditRoster(rosterRole) || !proposal || !rosterId) return
    setSaving(true)
    try {
      const margin = goalDifference === '' ? undefined : Number(goalDifference)
      if (margin !== undefined && (!Number.isInteger(margin) || margin < 0)) throw new Error('La diferencia de goles debe ser un entero positivo.')
      await recordMatch(rosterId, proposal.teamOne, proposal.teamTwo, proposal.unassigned?.id, result, margin, performanceRatings)
      const [updatedPlayers, updatedHistory, updatedOffsets, updatedChemistry] = await Promise.all([loadPlayers(rosterId), loadHistory(rosterId), loadLatestPlayerOffsets(rosterId), loadChemistryHistory(rosterId)])
      setPlayers(updatedPlayers); setHistory(updatedHistory.entries); setHistoryHasMore(updatedHistory.hasMore); setLatestOffsets(updatedOffsets); setChemistry(chemistryFromHistory(updatedChemistry)); setChemistryWithEvidence(chemistryWithSufficientEvidence(updatedChemistry)); setChemistryPairs(chemistryPairsFromHistory(updatedChemistry)); discardProposal(); setMessage('Resultado guardado y medias actualizadas.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo registrar el resultado.') } finally { setSaving(false) }
  }
  const saveHistoryEdit = async () => {
    if (!canEditRoster(rosterRole) || !editingHistory || !rosterId) return
    setSaving(true)
    try {
      const margin = goalDifference === '' ? undefined : Number(goalDifference)
      if (margin !== undefined && (!Number.isInteger(margin) || margin < 0)) throw new Error('La diferencia de goles debe ser un entero positivo.')
      await manageMatchHistory(editingHistory.id, 'edit', historyResult === 'teamOne' ? 'team_one' : historyResult === 'teamTwo' ? 'team_two' : 'draw', margin, performanceRatings)
      const [updatedPlayers, updatedHistory, updatedOffsets, updatedChemistry] = await Promise.all([loadPlayers(rosterId), loadHistory(rosterId), loadLatestPlayerOffsets(rosterId), loadChemistryHistory(rosterId)])
      setPlayers(updatedPlayers); setHistory(updatedHistory.entries); setHistoryHasMore(updatedHistory.hasMore); setLatestOffsets(updatedOffsets); setChemistry(chemistryFromHistory(updatedChemistry)); setChemistryWithEvidence(chemistryWithSufficientEvidence(updatedChemistry)); setChemistryPairs(chemistryPairsFromHistory(updatedChemistry)); discardProposal(); closeHistoryEditor(); setMessage('Partido editado y medias recalculadas.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo editar el partido.') } finally { setSaving(false) }
  }
  const deleteHistoryEntry = async (entry: HistoryEntry) => {
    if (!canEditRoster(rosterRole) || !rosterId || !window.confirm('¿Borrar este partido? Se recalcularán las medias Elo.')) return
    setSaving(true)
    try {
      await manageMatchHistory(entry.id, 'delete')
      const [updatedPlayers, updatedHistory, updatedOffsets, updatedChemistry] = await Promise.all([loadPlayers(rosterId), loadHistory(rosterId), loadLatestPlayerOffsets(rosterId), loadChemistryHistory(rosterId)])
      setPlayers(updatedPlayers); setHistory(updatedHistory.entries); setHistoryHasMore(updatedHistory.hasMore); setLatestOffsets(updatedOffsets); setChemistry(chemistryFromHistory(updatedChemistry)); setChemistryWithEvidence(chemistryWithSufficientEvidence(updatedChemistry)); setChemistryPairs(chemistryPairsFromHistory(updatedChemistry)); discardProposal(); setMessage('Partido borrado y medias recalculadas.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo borrar el partido.') } finally { setSaving(false) }
  }
  const logout = async () => {
    setSaving(true)
    try { await signOut() } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo cerrar sesión.') } finally { setSaving(false) }
  }
  const login = async () => {
    if (!configured) { setMessage('Conectá Supabase para usar tu plantel privado: faltan sus variables públicas en este entorno.'); return }
    try { await signInWithGoogle() } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo iniciar sesión.') }
  }
  const closeRosterAccess = () => {
    rosterAccessRequest.current += 1
    setRosterAccessOpen(false)
    window.requestAnimationFrame(() => inviteButtonRef.current?.focus())
  }
  const openRosterAccess = async () => {
    if (!rosterId || !canManageRosterAccess(rosterRole)) return
    const requestId = rosterAccessRequest.current + 1
    rosterAccessRequest.current = requestId
    setRosterAccessOpen(true); setRosterAccessEntries([]); setRosterAccessLoadError(null); setInvitationError(null); setRosterAccessLoading(true)
    try {
      const entries = await loadRosterAccess(rosterId)
      if (rosterAccessRequest.current === requestId) setRosterAccessEntries(entries)
    } catch (error) {
      if (rosterAccessRequest.current === requestId) setRosterAccessLoadError(error instanceof Error ? error.message : 'No se pudo cargar quiénes tienen acceso al plantel.')
    } finally {
      if (rosterAccessRequest.current === requestId) setRosterAccessLoading(false)
    }
  }
  const invite = async (role: Exclude<RosterRole, 'owner'>) => {
    if (!rosterId || !canInviteRole(rosterRole, role)) return
    await runOnce(invitationRequestInFlight, async () => {
      setInvitationLoading(true); setInvitationError(null)
      try {
        await generateWhatsAppInvitation(() => createRosterInvitation(rosterId, role), window.location.origin, window.location.pathname, (url) => window.location.assign(url))
      } catch (error) {
        setInvitationError(error instanceof Error ? error.message : 'No se pudo crear la invitación. Intentá de nuevo.')
      } finally { setInvitationLoading(false) }
    })
  }
  const refreshRosterAccess = async () => {
    if (!rosterId) return
    const entries = await loadRosterAccess(rosterId)
    setRosterAccessEntries(entries)
  }
  const changeRosterAccessRole = async (entry: RosterAccessEntry, role: Exclude<RosterRole, 'owner'>) => {
    if (!rosterId || rosterRole !== 'owner') return
    setRosterAccessActionUserId(entry.userId); setInvitationError(null)
    try {
      await updateRosterAccessRole(rosterId, entry.userId, role)
      await refreshRosterAccess()
      setMessage(`${entry.displayName} ahora es ${role === 'technical' ? 'parte del cuerpo técnico' : 'jugador/a'}.`)
    } catch (error) { setInvitationError(error instanceof Error ? error.message : 'No se pudo actualizar el rol.') }
    finally { setRosterAccessActionUserId(null) }
  }
  const removeRosterAccessEntry = async (entry: RosterAccessEntry) => {
    if (!rosterId || rosterRole !== 'owner' || !window.confirm(`¿Quitar el acceso de ${entry.displayName}?`)) return
    setRosterAccessActionUserId(entry.userId); setInvitationError(null)
    try {
      await removeRosterAccess(rosterId, entry.userId)
      await refreshRosterAccess()
      setMessage(`Se quitó el acceso de ${entry.displayName}.`)
    } catch (error) { setInvitationError(error instanceof Error ? error.message : 'No se pudo quitar el acceso.') }
    finally { setRosterAccessActionUserId(null) }
  }
  const transferOwnership = async (entry: RosterAccessEntry) => {
    if (!rosterId || rosterRole !== 'owner' || !window.confirm(`¿Transferir la propiedad del plantel a ${entry.displayName}? Vas a quedar como parte del cuerpo técnico.`)) return
    setRosterAccessActionUserId(entry.userId); setInvitationError(null)
    try {
      await transferRosterOwnership(rosterId, entry.userId)
      const [accessibleRosters] = await Promise.all([loadAccessibleRosters(), refreshRosterAccess()])
      setRosters(accessibleRosters); setRosterRole('technical'); setMessage(`${entry.displayName} ahora es la persona propietaria del plantel.`)
    } catch (error) { setInvitationError(error instanceof Error ? error.message : 'No se pudo transferir la propiedad.') }
    finally { setRosterAccessActionUserId(null) }
  }
  const historyParticipants = editingHistory?.playerOffsets.map((participant) => players.find((player) => player.id === participant.playerId) ?? { id: participant.playerId, name: participant.playerName, icon: '⚽', color: '#879381' }) ?? []

  if (!sessionReady) return <main className="app-shell"><header className="topbar"><h1>Fulbo<em>Parejo</em></h1><ThemeSelector preference={themePreference} onChange={changeThemePreference} /></header><section className="panel"><h2>Cargando tu vestuario…</h2></section></main>
  if (!userId) return <main className="landing-shell">{message && <NoticeToast message={message} onClose={() => setMessage(null)} />}<Suspense fallback={<TabLoader label="Armando la portada…" />}><LandingPage onLogin={() => void login()} themeControl={<ThemeSelector preference={themePreference} onChange={changeThemePreference} />} /></Suspense></main>
  if (adminRoute) return <><InstallPrompt authenticated={Boolean(userId)} afterMilestone={installReminderReady} open={installPromptOpen} onOpen={() => setInstallPromptOpen(true)} onClose={() => setInstallPromptOpen(false)} /><Suspense fallback={<main className="app-shell"><TabLoader label="Abriendo administración…" /></main>}><AdminPage onExit={() => { window.location.hash = '' }} /></Suspense></>

  return <main className="app-shell">
    <InstallPrompt authenticated={Boolean(userId)} afterMilestone={installReminderReady} open={installPromptOpen} onOpen={() => setInstallPromptOpen(true)} onClose={() => setInstallPromptOpen(false)} />
    {archiveNotice ? <NoticeToast message={`${archiveNotice.name} fue enviado a la papelera`} actionLabel={archivingPlayerId === archiveNotice.id ? 'Restaurando…' : 'Deshacer'} actionDisabled={archivingPlayerId === archiveNotice.id} onAction={() => void restore(archiveNotice)} onClose={() => setArchiveNotice(null)} /> : message && <NoticeToast message={message} onClose={() => setMessage(null)} />}
    <header className="topbar"><div><h1>Fulbo<em>Parejo</em></h1>{rosterId && <RosterSwitcher currentId={rosterId} rosters={rosters} userId={userId} saving={saving || rosterSaving} onSelect={requestRosterSelect} onCreate={saveRoster} onRename={saveRosterName} />}</div><div className="header-actions">{adminAvailable && <AdminDashboardButton onOpen={() => { window.location.hash = '#/admin' }} />}<InstallAppButton onOpen={() => setInstallPromptOpen(true)} /><SystemHelpButton onOpen={() => setRatingInfoOpen(true)} /><ThemeSelector preference={themePreference} onChange={changeThemePreference} />{canManageRosterAccess(rosterRole) && <button ref={inviteButtonRef} className="header-icon-button invite-button" aria-label="Acceso al plantel" title="Acceso al plantel" disabled={saving || rosterSaving} onClick={() => void openRosterAccess()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13.5a4 4 0 0 0 5.7.1l2-2a4 4 0 1 0-5.7-5.7l-1.1 1.1M14 10.5a4 4 0 0 0-5.7-.1l-2 2A4 4 0 1 0 12 18.1l1.1-1.1" /></svg></button>}<button className="header-icon-button logout-button" aria-label="Salir" title="Salir" disabled={saving || rosterSaving} onClick={() => void logout()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4H5v16h9" /><path d="M11 12h9m-3-3 3 3-3 3" /></svg></button></div></header>
    {tab === 'squad' && <Suspense fallback={<TabLoader />}><SquadTab editable={canEditRoster(rosterRole)} activePlayers={active} archivedPlayers={archivedPlayers} latestOffsets={latestOffsets} onCreatePlayer={() => openPlayerEditor()} onOpenPlayerDetail={openPlayerDetail} onEditPlayer={openPlayerEditor} onArchivePlayer={setArchiveCandidate} onRestorePlayer={restore} archivingPlayerId={archivingPlayerId} onExport={() => downloadJson(players)} /></Suspense>}
      {tab === 'match' && (rosterLoading ? <TabLoader panel label="Cargando tu plantel…" /> : <section className="match-flow"><section className="panel callup"><div className="panel-heading"><div><p className="eyebrow">1 · CONVOCATORIA</p><h2>¿Quiénes vinieron?</h2><p className="callup-counter">👥 {selectedPlayers.length} de {active.length} confirmados</p></div><div className="callup-actions"><button className="make-teams-button" onClick={makeTeams}>Armar equipos →</button>{proposal && <button className={customMode ? 'custom-mode-toggle active' : 'custom-mode-toggle'} aria-label="Activar modo custom" title="Modo custom" onClick={() => { const next = !customMode; setCustomMode(next); setManualSelection(null); setMessage(next ? 'Modo custom activo: tocá un jugador de cada equipo para intercambiarlos libremente.' : 'Modo equilibrado activo.') }}>{customMode ? '✦' : '🛠️'}</button>}</div></div><div className="callup-groups">{groupCallupPlayers(active).map((group) => <section className="callup-group" key={group.label}><p className="callup-group-label">{group.label}</p><div className="callup-group-chips">{group.players.map((player) => <button className={selected.has(player.id) ? 'player-chip selected' : 'player-chip'} key={player.id} onClick={() => setSelected((current) => { const next = new Set(current); next.has(player.id) ? next.delete(player.id) : next.add(player.id); return next })}><span style={{ backgroundColor: player.color }}>{player.icon}</span>{player.name}</button>)}</div></section>)}</div>{active.length === 0 && <p className="muted">Primero cargá los jugadores desde Plantel.</p>}</section>{proposal && <><section className="versus"><div className="team-card orange"><p className="eyebrow">{proposal.teamOne.name}</p><h2>{fmt(mean(proposal.teamOne))}</h2><span>media operativa</span>{proposal.teamOne.players.map((player) => <div className="team-player" key={player.id}><button type="button" className="team-player-detail" aria-label={`Ver ficha de ${player.name}`} onClick={() => void openPlayerDetail(player)}><i style={{ backgroundColor: player.color }}>{player.icon}</i>{player.name}</button><button type="button" className="team-player-swap" aria-label={`Cambiar a ${player.name} de equipo`} onClick={() => swapComparable(player.id, 'teamOne')}><span className="team-player-details"><OffsetIndicator offset={latestOffsets.get(player.id)} /><small>{fmt(operationalRating(player))}</small></span>↔</button></div>)}</div><div className="vs">VS <button type="button" className="balance-gap-trigger" aria-label={`Ver por qué quedaron parejos: diferencia de ${fmt(proposal.balanceGap)} de media`} aria-haspopup="dialog" onClick={() => setMatchmakingExplanationOpen(true)}>Δ {fmt(proposal.balanceGap)}</button></div><div className="team-card blue"><p className="eyebrow">{proposal.teamTwo.name}</p><h2>{fmt(mean(proposal.teamTwo))}</h2><span>media operativa</span>{proposal.teamTwo.players.map((player) => <div className="team-player" key={player.id}><button type="button" className="team-player-detail" aria-label={`Ver ficha de ${player.name}`} onClick={() => void openPlayerDetail(player)}><i style={{ backgroundColor: player.color }}>{player.icon}</i>{player.name}</button><button type="button" className="team-player-swap" aria-label={`Cambiar a ${player.name} de equipo`} onClick={() => swapComparable(player.id, 'teamTwo')}><span className="team-player-details"><OffsetIndicator offset={latestOffsets.get(player.id)} /><small>{fmt(operationalRating(player))}</small></span>↔</button></div>)}</div></section><section className="panel pitch-panel"><div className="panel-heading"><div><p className="eyebrow">2 · PIZARRA</p><h2>Cancha del partido</h2></div><button onClick={() => void shareMatch(proposal.teamOne, proposal.teamTwo, latestOffsets, activeRosterName)}>Compartir ↗</button></div><div className="pitches"><Pitch team={proposal.teamOne} /><Pitch team={proposal.teamTwo} /></div></section>{canEditRoster(rosterRole) && <section className="panel result"><p className="eyebrow">3 · RESULTADO</p><h2>¿Quién ganó?</h2><div className="result-actions"><button className="orange-result" disabled={saving} onClick={() => openResultEditor('teamOne')}>Ganó Claro</button><button className="draw-result" disabled={saving} onClick={() => openResultEditor('draw')}>Empate</button><button className="blue-result" disabled={saving} onClick={() => openResultEditor('teamTwo')}>Ganó Oscuro</button></div></section>}</>}</section>)}
    {tab === 'history' && <Suspense fallback={<TabLoader />}><HistoryTab editable={canEditRoster(rosterRole)} history={history} saving={saving} hasMore={historyHasMore} loadingMore={historyLoadingMore} onEdit={openHistoryEditor} onDelete={deleteHistoryEntry} onLoadMore={loadMoreHistory} /></Suspense>}
    {editorOpen && <PlayerEditor draft={draft} editingPlayer={editingPlayer} saving={saving} onClose={() => setEditorOpen(false)} onSubmit={(event) => void savePlayer(event)} onChange={setDraft} />}
    {pendingResult && proposal && <ResultEditor result={pendingResult} goalDifference={goalDifference} saving={saving} participants={[...proposal.teamOne.players, ...proposal.teamTwo.players]} performanceRatings={performanceRatings} onClose={closeResultEditor} onGoalDifferenceChange={setGoalDifference} onPerformanceChange={setPlayerPerformance} onSave={() => void record(pendingResult)} />}
    {editingHistory && <ResultEditor result={historyResult} goalDifference={goalDifference} saving={saving} participants={historyParticipants} performanceRatings={performanceRatings} onClose={closeHistoryEditor} onGoalDifferenceChange={setGoalDifference} onPerformanceChange={setPlayerPerformance} onResultChange={setHistoryResult} onSave={() => void saveHistoryEdit()} />}
    {detailPlayer && <PlayerDetail player={detailPlayer} players={players} history={playerMatchHistory} chemistryPairs={chemistryPairs} loading={playerHistoryLoading} error={playerHistoryError} onClose={closePlayerDetail} />}
    {rosterAccessOpen && (rosterRole === 'owner' || rosterRole === 'technical') && <RosterAccessDialog actorRole={rosterRole} entries={rosterAccessEntries} loading={rosterAccessLoading} loadError={rosterAccessLoadError} inviteError={invitationError} inviting={invitationLoading} actionUserId={rosterAccessActionUserId} onClose={closeRosterAccess} onInvite={(role) => void invite(role)} onChangeRole={(entry, role) => void changeRosterAccessRole(entry, role)} onRemove={(entry) => void removeRosterAccessEntry(entry)} onTransfer={(entry) => void transferOwnership(entry)} />}
    {rosterSetupOpen && <RosterNameDialog title="Tu primer plantel" saving={rosterSaving} onSave={saveRoster} />}
    {rosterSwitchTarget && <RosterSwitchConfirm onCancel={() => setRosterSwitchTarget(null)} onConfirm={() => { selectRoster(rosterSwitchTarget); setRosterSwitchTarget(null) }} />}
    {ratingInfoOpen && <RatingInfo onClose={() => setRatingInfoOpen(false)} />}
    {matchmakingExplanationOpen && proposal && <MatchmakingExplanationDialog proposal={proposal} onClose={() => setMatchmakingExplanationOpen(false)} />}
    {archiveCandidate && <ArchivePlayerDialog player={archiveCandidate} saving={archivingPlayerId === archiveCandidate.id} onClose={() => setArchiveCandidate(null)} onConfirm={() => void archive()} />}
    <footer className="cafecito-support">
      <a href="https://cafecito.app/juanikitro" rel="noopener noreferrer" target="_blank">☕ <span>Doname un cafecito</span></a>
      <a className="whatsapp-feedback" href="https://wa.me/5492345455007?text=Hola%2C%20tengo%20una%20sugerencia%20o%20encontr%C3%A9%20un%20bug%20en%20Fulbo%20Parejo%3A" rel="noopener noreferrer" target="_blank">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
        <span>Mandanos tu idea</span>
      </a>
    </footer>
    <nav className="bottom-nav">{([['squad', '👥', 'Plantel'], ['match', '⚽', 'Nuevo partido'], ['history', '📋', 'Historial']] as const).map(([key, icon, label]) => <button className={tab === key ? 'active' : ''} key={key} onClick={() => setTab(key)}><span>{icon}</span>{label}</button>)}</nav>
  </main>
}
