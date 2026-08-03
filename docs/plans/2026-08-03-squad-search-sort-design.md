# Búsqueda y orden del Plantel

## Objetivo

Permitir encontrar jugadores del Plantel al instante y cambiar el orden sin recargar la página.

## Interacción

- Un campo de búsqueda filtra por nombre, sin distinguir mayúsculas ni acentos.
- Un selector define el orden: puntaje, nombre, posición o buff/debuff.
- El orden inicial es puntaje descendente, calculado con la media operativa.
- Por posición se usa el orden futbolístico del catálogo; los empates se resuelven por nombre.
- Por buff/debuff se usa el último cambio de media: mayores subidas primero, luego neutros y finalmente bajas.
- Búsqueda y orden se aplican en el navegador sobre el Plantel ya cargado.
- Si no hay resultados, se muestra un estado vacío claro.

## Alcance

Cambios locales en `SquadTab` y sus estilos. No hay cambios de base de datos ni de carga de datos.
