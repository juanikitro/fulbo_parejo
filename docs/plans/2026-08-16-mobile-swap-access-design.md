# Acceso móvil para cambiar jugadores

## Objetivo

Mantener disponible el cambio de jugadores después de armar los equipos, incluso cuando las acciones compactas de cada fila no entren en una pantalla angosta.

## Diseño

- Se conserva la flecha de cada jugador en pantallas con espacio suficiente.
- Debajo de los equipos aparece un bloque `Cambiar jugadores` con ambos equipos y un botón amplio por jugador.
- Cada botón reutiliza el intercambio automático existente. En modo custom mantiene la misma selección de dos jugadores; no recalcula el armado ni descarta el resultado pendiente.
- En móvil, las listas pasan a una sola columna y los botones muestran nombre e ícono, sin depender de la media ni de la flecha comprimida.

## Validación

- Compilación TypeScript/Vite y pruebas existentes.
- Verificación manual en viewport móvil: aplicar un cambio desde el bloque, conservar los equipos modificados y abrir el registro de resultado.
