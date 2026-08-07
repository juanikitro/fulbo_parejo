# Reintentos al cargar el plantel

## Objetivo

Evitar que una falla transitoria al cargar el plantel termine de inmediato en el aviso de error.

## Diseño aprobado

Las lecturas que cargan los planteles disponibles, la selección activa, jugadores, historial, offsets, química y rol usarán un helper común. Cada una tendrá hasta cinco reintentos adicionales (seis intentos en total), separados por un segundo. La interfaz mantendrá su indicador de carga y sólo conservará el mensaje de error actual cuando falle el último intento.

Aceptar una invitación conserva un único intento: no se reintenta una escritura cuyo resultado pueda haber sido aplicado pese a un corte de red.

## Validación

El helper se prueba de forma aislada para confirmar el número de intentos, las pausas y la propagación del último error.
