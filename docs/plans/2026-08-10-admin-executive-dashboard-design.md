# Dashboard administrativo ejecutivo

## Objetivo

Hacer más útil el resumen administrativo para una lectura ejecutiva rápida, sin modificar permisos, endpoints, consultas ni definiciones de las métricas.

## Diseño aprobado

- El resumen abre con cuatro métricas prioritarias: usuarios registrados, planteles, partidos completos y finalización.
- Las métricas restantes pasan a un bloque secundario de contexto.
- Las señales operativas reutilizan los datos existentes para mostrar invitaciones pendientes, partidos sin resultado y jugadores archivados.
- El gráfico de evolución recibe mayor jerarquía visual y una lectura más clara de sus series.
- Adopción, listados y detalle conservan su flujo actual con superficies, estados y controles consistentes.
- La interfaz continúa funcionando en tema claro y oscuro, y los listados mantienen su tabla semántica y desplazamiento horizontal en móvil.

## Límites

No se agregan dependencias ni telemetría. No se alteran contratos de `admin-metrics`, RLS, autorización, datos persistidos ni la semántica de los indicadores.

## Validación

Ejecutar el build de TypeScript/Vite y las pruebas existentes de administración. Revisar visualmente los estados de resumen, carga, error y acceso denegado cuando haya una sesión administrativa disponible.
