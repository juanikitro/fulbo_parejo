import { useEffect, useState, type ReactNode } from 'react'

const kickoffSteps = [
  { number: '1', title: 'Cargá el plantel', text: 'Nombre, media inicial, puesto preferido, ícono y color. Una sola vez.' },
  { number: '2', title: 'Marcá quiénes juegan', text: 'La cantidad de convocados define el tamaño de los dos equipos.' },
  { number: '3', title: 'Armá los equipos', text: 'Busca el reparto más parejo posible y te muestra la diferencia que quedó.' },
  { number: '4', title: 'Cargá el resultado', text: 'Quién ganó, por cuánto y cómo jugó cada uno. Las medias se actualizan solas.' },
]

const ratings = [
  { term: 'Media base', text: 'La ponés vos al cargar al jugador. Ningún resultado la toca.' },
  { term: 'Media aprendida', text: 'Arranca igual a la base y se mueve partido a partido. Es la memoria del sistema.' },
  { term: 'Media operativa', text: '40% base + 60% aprendida. Es la única que mira el armado para comparar jugadores.' },
]

const eloOutcomes = [
  { term: 'Gana el favorito', text: 'Era lo esperable: las medias casi no se mueven.' },
  { term: 'Empate', text: 'El menos favorito sube y el favorito baja.' },
  { term: 'Gana el de abajo', text: 'Batacazo: el ajuste más grande de los tres.' },
]

const performanceLadder = [
  { symbol: '↓', label: 'Muy mal', detail: 'Suma la mitad. Resta un 50% más.' },
  { symbol: '↘', label: 'Mal', detail: 'Suma un 75%. Resta un 125%.' },
  { symbol: '−', label: 'Normal', detail: 'El cambio sale tal cual.' },
  { symbol: '↗', label: 'Bien', detail: 'Suma un 125%. Resta un 75%.' },
  { symbol: '↑', label: 'Muy bien', detail: 'Suma un 150%. Resta la mitad.' },
]

const boardRules = [
  { term: 'Arqueros', text: 'Si hay dos o más, uno por equipo. Si hay uno solo, el equipo sin arquero recibe una compensación de fuerza.' },
  { term: 'Puestos', text: 'Amontonar una línea de un lado paga una penalización suave. Ordena el reparto, nunca le gana al equilibrio.' },
  { term: 'Impares', text: 'Queda afuera el que deja los equipos más parejos. No hay rotación obligatoria.' },
  { term: 'Cambios', text: 'Te propone un reemplazo de fuerza y puesto parecidos, o cruzás a quien quieras en modo custom.' },
]

const extras = [
  { term: 'Pizarra', text: 'Las dos formaciones dibujadas sobre la cancha.' },
  { term: 'Al grupo', text: 'Texto e imagen del armado listos para WhatsApp.' },
  { term: 'Plantel privado', text: 'Solo tu cuenta ve y edita tu plantel y tu historial.' },
  { term: 'Invitaciones', text: 'Si hay más de un DT, se puede compartir el plantel.' },
  { term: 'Historial editable', text: 'Corregís un resultado y las medias se recalculan.' },
  { term: 'Respaldo', text: 'Descargá el plantel entero en JSON.' },
]

function GoogleButton({ onLogin, compact = false }: { onLogin: () => void; compact?: boolean }) {
  return <button className={compact ? 'google-login google-login-compact' : 'google-login'} onClick={onLogin}><span aria-hidden="true">G</span>Continuar con Google <b aria-hidden="true">→</b></button>
}

function Rows({ items }: { items: { term: string; text: string }[] }) {
  return <dl className="landing-rows">{items.map((item) => <div key={item.term}><dt>{item.term}</dt><dd>{item.text}</dd></div>)}</dl>
}

export default function LandingPage({ onLogin, themeControl }: { onLogin: () => void; themeControl: ReactNode }) {
  const [stickyVisible, setStickyVisible] = useState(false)

  useEffect(() => {
    // The sticky button steps aside near the closing call to action so both never show at once.
    const onScroll = () => setStickyVisible(window.scrollY > 620 && window.scrollY + window.innerHeight < document.body.scrollHeight - 640)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return <div className="landing">
    <header className="landing-masthead">
      <div className="landing-wrap landing-masthead-inner"><h1>Fulbo<em>Parejo</em></h1>{themeControl}</div>
    </header>

    <section className="landing-cover">
      <div className="landing-wrap landing-cover-inner">
        <p className="landing-kicker">PARA EL PARTIDO DE LOS AMIGOS</p>
        <h2 className="landing-headline">Se terminaron los <em>equipos desparejos</em></h2>
        <p className="landing-lead">FulboParejo arma los equipos por vos: aprende de cada resultado y reparte la cancha para que el partido salga parejo.</p>
        <div className="landing-cta"><GoogleButton onLogin={onLogin} /><p className="landing-cta-note">Entrás con Google y listo. Tu plantel queda privado, sin instalar nada.</p></div>
      </div>
    </section>

    <section className="landing-wrap landing-section">
      <p className="landing-eyebrow">LA PREVIA</p>
      <h3 className="landing-title">Siempre termina igual</h3>
      <p className="landing-body landing-dropcap">Armar equipos no es fácil. No todos los días jugás igual. No todos juegan igual con todos. Armar equipos a ojo no escala. Algunos no se mueven si no les decís que ganan o pierden puntos. Algunos necesitan competir.</p>
      <blockquote className="landing-quote">Un partido parejo no se sortea. Se calcula.</blockquote>
    </section>

    <section className="landing-wrap landing-section">
      <p className="landing-eyebrow">CÓMO SE USA</p>
      <h3 className="landing-title">Cuatro pasos</h3>
      <ol className="landing-rows">{kickoffSteps.map((step) => <li key={step.number}><h4><span aria-hidden="true">{step.number}</span>{step.title}</h4><p>{step.text}</p></li>)}</ol>
    </section>

    <section className="landing-wrap landing-section">
      <p className="landing-eyebrow">EL PUNTAJE</p>
      <h3 className="landing-title">Cada jugador tiene tres medias</h3>
      <p className="landing-body">Una la escribís vos, otra la escribe la cancha, y la tercera es la que sale a jugar.</p>
      <Rows items={ratings} />
    </section>

    <section className="landing-wrap landing-section">
      <p className="landing-eyebrow">EL ELO</p>
      <h3 className="landing-title">Ganarle al favorito vale más</h3>
      <p className="landing-body">Antes del partido se comparan las medias promedio de los dos equipos para saber quién era favorito. Después el sistema corrige la diferencia entre lo esperado y lo que pasó de verdad.</p>
      <Rows items={eloOutcomes} />
      <p className="landing-note">La diferencia de goles agranda el ajuste de forma gradual y con tope: un 8 a 0 no te rompe las medias del plantel.</p>
    </section>

    <section className="landing-wrap landing-section">
      <p className="landing-eyebrow">EL RENDIMIENTO</p>
      <h3 className="landing-title">No todos jugaron el mismo partido</h3>
      <p className="landing-body">Al cargar el resultado le ponés nota a cada uno. La nota no inventa puntos: estira o achica el cambio de Elo que ya le tocaba.</p>
      <dl className="landing-rows landing-ladder">{performanceLadder.map((level, index) => <div key={level.label}><dt><span className={`landing-dot performance-${index}`} aria-hidden="true">{level.symbol}</span>{level.label}</dt><dd>{level.detail}</dd></div>)}</dl>
    </section>

    <section className="landing-wrap landing-section">
      <p className="landing-eyebrow">LA QUÍMICA</p>
      <h3 className="landing-title">Hay dupla que se busca sola</h3>
      <p className="landing-body">El sistema mira con quién compartió equipo cada jugador. Ganar juntos suma química, empatar suma poco y perder resta. Hasta los cuatro partidos compartidos la señal pesa menos: una noche buena no hace una sociedad.</p>
      <p className="landing-body">Al armar, junta a las duplas que funcionan y separa a las que vienen rindiendo peor, pero siempre suave: la química nunca se le impone al equilibrio de medias.</p>
    </section>

    <section className="landing-wrap landing-section">
      <p className="landing-eyebrow">EL ARMADO</p>
      <h3 className="landing-title">Las reglas de la pizarra</h3>
      <Rows items={boardRules} />
    </section>

    <section className="landing-wrap landing-section">
      <p className="landing-eyebrow">ADEMÁS</p>
      <h3 className="landing-title">Lo que viene en la caja</h3>
      <Rows items={extras} />
    </section>

    <section className="landing-closing">
      <div className="landing-wrap landing-closing-inner">
        <h3 className="landing-closing-title">El plantel te está esperando</h3>
        <p>Cargalo una vez, armá el primer partido y dejá que el resto lo aprenda la cancha.</p>
        <GoogleButton onLogin={onLogin} />
        <p className="landing-cta-note">Gratis, sin instalación. Tu plantel, tus partidos y tu historial son solo tuyos.</p>
      </div>
    </section>

    <footer className="landing-footer"><div className="landing-wrap"><p>FulboParejo · para el fútbol de los amigos</p></div></footer>

    <div className={stickyVisible ? 'landing-sticky visible' : 'landing-sticky'}><GoogleButton onLogin={onLogin} compact /></div>
  </div>
}
