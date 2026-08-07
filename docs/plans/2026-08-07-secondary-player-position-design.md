# Posicion secundaria del jugador

## Objetivo

Permitir una posicion secundaria opcional para mejorar el armado de equipos sin
alterar la posicion existente: `preferred_position` pasa a representarse en la
interfaz como posicion primaria.

## Modelo de datos

Se agrega `secondary_position` nullable a `public.players`. Usa los mismos diez
codigos de posicion que la primaria. Si existe, requiere una primaria y no puede
repetirla. Los jugadores existentes conservan su posicion actual como primaria y
quedan sin secundaria.

## Interfaz

El editor muestra primero el selector de posicion primaria y, debajo, el de
posicion secundaria opcional. Al elegir la primaria, esa opcion no se ofrece en
el selector secundario. La ficha de jugador muestra ambas cuando corresponda;
la cancha continua mostrando la primaria.

## Armado y cambios sugeridos

El balance conserva la media como criterio principal. Las posiciones primarias
tienen prioridad en la penalizacion posicional y al asignar arqueros. Una
posicion secundaria aporta cobertura con menor peso y solo se usa como arquero
de respaldo si no hay dos arqueros primarios. Los cambios compatibles primero
prefieren la coincidencia primaria y luego una coincidencia con secundaria.

## Validacion

Se agregan pruebas unitarias para el matcher: primaria preferida, cobertura
secundaria y arqueros de respaldo. No se aplica la migracion a una base remota.
