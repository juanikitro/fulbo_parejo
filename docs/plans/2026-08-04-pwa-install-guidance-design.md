# Guía persistente de instalación PWA

## Objetivo

Hacer visible el camino de instalación en iPhone sin depender del diálogo nativo, que iOS no expone a las webs.

## Diseño aprobado

- Mostrar un botón `Instalar` en el encabezado sólo si la app aún no corre instalada.
- Al tocarlo, abrir el mismo diálogo de instalación. En iPhone/iPad, explicar visualmente `Safari → Compartir → Agregar a pantalla de inicio`; en otros navegadores, conservar las instrucciones o el prompt nativo.
- Mostrar el recordatorio automático después de crear el primer plantel, no sólo al iniciar sesión.
- El cierre del recordatorio conserva la postergación de 30 días, pero no oculta el acceso persistente.

## Verificación

- Tests unitarios de la elegibilidad del recordatorio y de las instrucciones iOS.
- Compilación de producción.
