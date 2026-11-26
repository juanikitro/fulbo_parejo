# Reintentos al cargar el plantel

## Objetivo

Evitar que una falla transitoria al cargar el plantel termine de inmediato en el aviso de error.

## Diseño aprobado

Las lecturas que cargan los planteles disponibles, la selección activa, jugadores, historial, offsets, química y rol usarán un helper común. Cada una tendrá hasta cinco reintentos adicionales (seis intentos en total), separados por un segundo. La interfaz mantendrá su indicador de carga y sólo conservará el mensaje de error actual cuando falle el último intento.

Aceptar una invitación conserva un único intento: no se reintenta una escritura cuyo resultado pueda haber sido aplicado pese a un corte de red.

## Validación

El helper se prueba de forma aislada para confirmar el número de intentos, las pausas y la propagación del último error.

## Acceso a un plantel compartido sin plantel propio

Al iniciar, la aplicación busca primero un plantel propio. Si no lo encuentra, selecciona el acceso compartido más antiguo de la cuenta desde `roster_access`, con los permisos existentes. La vista antigua `roster_members` no admite lecturas de usuarios autenticados: devolvía 403 antes de que se cargaran los jugadores y el historial. Los reintentos no resuelven ese error de permisos.

La prueba de regresión reproduce la denegación de la vista antigua y comprueba que se selecciona el plantel compartido sin crear otro. Tras el despliegue, una cuenta colaboradora sin plantel propio debe poder volver a entrar sin enlace de invitación y ver el plantel con su rol actual.
