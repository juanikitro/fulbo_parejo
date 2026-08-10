# Selector editable al registrar un partido

## Objetivo

Permitir corregir el ganador desde el formulario de registro antes de guardar el partido.

## Diseño aprobado

- Los tres botones de resultado que abren el formulario se conservan.
- El botón elegido abre el formulario con ese resultado preseleccionado.
- Dentro del formulario se muestran `Ganó Claro`, `Empate` y `Ganó Oscuro`.
- La persona puede cambiar entre las tres opciones hasta guardar; sólo se persiste la selección final.
- El formulario de edición de historial mantiene el mismo patrón para evitar dos comportamientos distintos.

## Alcance y validación

El cambio se limita al estado del resultado del modal y a sus controles. Se valida con las pruebas y el build existentes.
