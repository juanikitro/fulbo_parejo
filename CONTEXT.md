# Fulbo Matchmaking

Herramienta interna para organizar partidos de fútbol entre amigos y aprender a equilibrar los equipos a partir de sus resultados.

## Language

**Jugador**:
Persona que participa de los partidos y tiene una valoración usada para formar equipos.
_Avoid_: Usuario, miembro

**Cuenta**:
Identidad autenticada de una persona que usa la aplicación y es propietaria de un único Plantel.
_Avoid_: Usuario del plantel, perfil

**Plantel**:
Conjunto permanente de Jugadores perteneciente a una Cuenta, del que se seleccionan los Convocados para cada Partido.
_Avoid_: Lista de asistentes, equipo

**Privacidad del Plantel**:
Regla por la que sólo la Cuenta propietaria puede leer o modificar su Plantel, sus Partidos y su Historial.
_Avoid_: Plantel compartido, acceso público

**Autenticación Google**:
Mecanismo por el que una Cuenta se identifica mediante su identidad de Google, sin credenciales locales propias de la aplicación.
_Avoid_: Login local, usuario y contraseña

**Reinicio de valoración**:
Operación explícita que restablece la Valoración aprendida de un Jugador a partir de su Valoración base, sin borrar el Historial de Partidos.
_Avoid_: Editar rating aprendido, borrar historial

**Identidad visual**:
Combinación de un icono futbolero y un color asignados a un Jugador para reconocerlo rápidamente en el Plantel y en los Equipos.
_Avoid_: Avatar fotográfico, imagen de perfil

**Catálogo visual**:
Conjunto cerrado de iconos futboleros y colores disponibles para la Identidad visual de cada Jugador.
_Avoid_: Upload de avatar, color libre

**Jugador archivado**:
Jugador que deja de estar disponible para nuevas convocatorias, pero mantiene su Historial y sus valoraciones dentro del Plantel.
_Avoid_: Jugador eliminado, borrado

**Recálculo de valoraciones**:
Reconstrucción de las Valoraciones aprendidas recorriendo el Historial corregido en orden, sin perder los Resultados registrados.
_Avoid_: Ajuste manual masivo, borrar aprendizajes

**Precisión de valoración**:
Las valoraciones se muestran con dos decimales, mientras los cálculos internos conservan la mayor precisión viable para evitar pérdidas acumulativas.
_Avoid_: Redondeo a entero, precisión visible como fuente de cálculo

**Inicialización de valoración**:
Al crear un Jugador, su Valoración aprendida comienza igual a su Valoración base.
_Avoid_: Rating aprendido vacío, valor por defecto global

**Mobile-first**:
Prioridad de diseño por la que el flujo de Plantel, convocatoria, armado e ingreso de Resultado debe ser cómodo desde un teléfono antes que desde una pantalla grande.
_Avoid_: Desktop-first, panel administrativo denso

**Conectividad requerida**:
La primera versión necesita conexión a internet para leer y guardar el Plantel, el Historial y las valoraciones en la base de datos; no ofrece sincronización offline.
_Avoid_: Modo offline, sincronización local

**Formación genérica**:
Distribución visual de respaldo para cualquier cantidad par que no tenga un Layout de cancha específico, sin introducir nuevas reglas de Matchmaking.
_Avoid_: Formación personalizada por usuario

**Layout de cancha**:
Representación visual frontend de cada Equipo sobre una cancha según la modalidad del Partido, con jugadores ubicados en posiciones de juego. No contiene lógica de balance ni altera el Matchmaking, el Resultado o la persistencia.
_Avoid_: Nuevo sorteo, simulación táctica

**Prioridad posicional**:
Desempate para asignar posiciones en el Layout de cancha cuando varios Jugadores compiten por una misma Posición preferida; favorece la mayor Valoración operativa.
_Avoid_: Prioridad por antigüedad, posición obligatoria

**Formación fija**:
Distribución predeterminada de posiciones que el Layout de cancha muestra para una modalidad 5, 6, 8 u 11, sin edición ni efecto sobre el Matchmaking. Para otras cantidades pares se usa una formación genérica.
_Avoid_: Formación arrastrable, táctica configurable

**Resumen para WhatsApp**:
Exportación mobile del armado confirmado que combina un texto con los dos Equipos y una imagen del Layout de cancha para compartir mediante la hoja nativa del dispositivo.
_Avoid_: Copiar sólo nombres, enlace público al partido

**Exportación JSON**:
Descarga manual del Plantel, Jugadores, Partidos, Resultados y valoraciones en un formato versionado. Es una copia de respaldo y no la fuente principal de persistencia.
_Avoid_: Importación inicial, JSON como base de datos online

**Semilla Elo**:
Valoración aprendida inicial e inmutable de un Jugador, igual a su Valoración base al incorporarlo. El Recálculo de valoraciones reproduce el Historial desde esta semilla.
_Avoid_: Último rating guardado como origen, reset implícito

**Presentación de valoración**:
Forma visible de mostrar la Valoración base y la aprendida con un decimal, aunque el cálculo interno conserve mayor precisión.
_Avoid_: Redondeo persistido

**Valoración base**:
Puntaje manual de 1 a 10 asignado por la persona organizadora, tomando 10 como referencia del mejor Jugador del grupo. Nunca se modifica por los resultados.
_Avoid_: Rating inicial, puntaje definitivo

**Valoración aprendida**:
Estimación numérica que se ajusta gradualmente a partir del Historial y se conserva aunque cambie la Valoración base. Se muestra junto con la base y participa en la Valoración operativa.
_Avoid_: Rating manual, promedio fijo

**Ajuste Elo**:
Actualización gradual de la Valoración aprendida que compara el resultado observado con la expectativa calculada a partir de las fuerzas de los Equipos.
_Avoid_: Subida fija, promedio de resultados

**Diferencia de goles**:
Cantidad de goles por la que un Equipo supera al otro; es opcional en un Resultado y modula moderadamente el Ajuste Elo cuando está disponible.
_Avoid_: Marcador completo

**Penalización posicional**:
Ajuste suave que desincentiva distribuciones extremas de Posiciones preferidas sin imponerse al equilibrio de la Valoración operativa.
_Avoid_: Restricción táctica, formación obligatoria

**Valoración operativa**:
Puntaje combinado de la Valoración base y la Valoración aprendida que el Matchmaking utiliza para comparar Jugadores; inicialmente pondera 40% la base y 60% la aprendida.
_Avoid_: Rating final, puntaje actual

**Partido**:
Encuentro registrado entre dos equipos formados a partir de jugadores disponibles.
_Avoid_: Fecha, evento

**Equipo**:
Uno de los dos grupos del mismo tamaño que disputan un partido; ese tamaño se define al armarlo.
_Avoid_: Lado, grupo

**Posición preferida**:
Rol de juego que un Jugador prefiere ocupar: PO, DFI, DFC, DFD, MC, MD, MI, DC, EI o ED. Guía secundariamente el Matchmaking por línea y puesto específico, sin prevalecer sobre el equilibrio de fuerza.
_Avoid_: Puesto fijo, formación obligatoria

**Portero**:
Jugador cuya Posición preferida es PO y custodia el arco. Si hay al menos dos disponibles, cada Equipo debe tener exactamente uno.
_Avoid_: Arquero, goalkeeper

**Compensación por arquero**:
Ventaja adicional de fuerza asignada al Equipo que no recibe el único Arquero disponible para equilibrar su desventaja deportiva.
_Avoid_: Penalización de arquero

**Matchmaking**:
Proceso de dividir a los jugadores disponibles en equipos con fuerza estimada similar.
_Avoid_: Sorteo, armado manual

**Historial**:
Conjunto persistido de jugadores y partidos registrados que permite ajustar las valoraciones.
_Avoid_: Datos de sesión, memoria temporal

**Resultado**:
Registro del Equipo ganador, o de un empate, y opcionalmente de la diferencia de goles. Alimenta el ajuste de la Valoración aprendida.
_Avoid_: Marcador completo, tanteador

**Convocado**:
Jugador disponible para participar en un Partido concreto. La cantidad de Convocados determina el tamaño de los dos Equipos.
_Avoid_: Asistente, jugador del padrón

**No asignado**:
Convocado que queda fuera de los dos Equipos cuando la cantidad total de Convocados es impar.
_Avoid_: Suplente automático, descartado

**Criterio de descarte**:
Elección del No asignado que minimiza la diferencia de fuerza entre los dos Equipos, por encima de cualquier criterio de rotación.
_Avoid_: Rotación obligatoria

**Explicación del armado**:
Resumen que acompaña al Matchmaking con la fuerza de cada Equipo y las comprobaciones de arqueros y Posiciones preferidas relevantes.
_Avoid_: Debug, detalle técnico

**Intercambio manual**:
Cambio explícito de jugadores entre los dos Equipos después de un Matchmaking, que debe recalcular su explicación antes de confirmarse.
_Avoid_: Edición silenciosa, override
