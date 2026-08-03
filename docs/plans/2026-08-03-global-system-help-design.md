# Ayuda global del sistema

## Objetivo

Hacer accesible, durante la sesión iniciada, una explicación transparente de las reglas de Fulbo Parejo desde el encabezado de la aplicación.

## Diseño aprobado

- Mover el botón `i` desde el título de Plantel al encabezado, junto al selector de apariencia.
- Reutilizar y renombrar el modal existente como **Cómo funciona Fulbo Parejo**.
- Reunir en ese modal las reglas de medias, armado, Elo, rendimiento, química, pizarra, intercambios e historial.
- Mantener el modal sólo dentro de la sesión iniciada; no mostrarlo en inicio de sesión ni en la configuración sin Supabase.

## Verificación

- Compilación de producción y comprobación estática de referencias eliminadas del botón local.
