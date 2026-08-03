# Múltiples planteles

## Objetivo

Permitir que una Cuenta alterne rápidamente entre varios Planteles propios y compartidos, sin mezclar Jugadores, Partidos, Historial ni valoraciones.

## Decisiones MVP

- El selector compacto del encabezado abre una hoja inferior con planteles propios, compartidos y la acción para crear uno nuevo.
- Una Cuenta puede crear varios Planteles y colaborar en otros. El último seleccionado se recuerda por Cuenta.
- Sólo la Cuenta dueña puede renombrar e invitar. Los Colaboradores gestionan Jugadores y Partidos.
- Una Cuenta nueva nombra su primer Plantel; los planteles existentes se conservan intactos.
- Si hay convocatoria, equipos o cambios sin guardar, alternar requiere confirmación y descarta sólo el estado local.

## Límites

No se incluyen transferencia de propiedad, bajas de colaboradores, revocación de invitaciones, borrado de planteles, clonación ni borradores persistentes.

## Aislamiento

Cada dato de juego sigue ligado a `roster_id`. Las políticas RLS permiten acceso sólo a la Cuenta dueña o miembro; la preferencia de plantel activo valida esa misma pertenencia.
