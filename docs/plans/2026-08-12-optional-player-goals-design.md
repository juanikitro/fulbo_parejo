# Goles opcionales por jugador

## Objetivo

Registrar goles por jugador al guardar o editar un partido y ordenar el Plantel por goleadores, sin obligar a completar el dato.

## Contrato

- `match_participants.goals` es un entero nullable no negativo.
- Un input vacío se guarda como `NULL`; no equivale a cero goles.
- Los RPC validan los participantes y preservan la autorización de `owner` y `technical`.
- Plantel ordena por la suma de goles registrados y muestra `—` cuando no hay datos.

## Validación

- Pruebas de conversión y acumulación de goles.
- Build, CI, migración de Supabase y smoke de producción antes del cierre.
