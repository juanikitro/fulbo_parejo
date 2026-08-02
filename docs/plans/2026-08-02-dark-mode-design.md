# Modo oscuro

## Objetivo

Incorporar un tema oscuro sin alterar los flujos de Plantel, Partido, Historial ni la persistencia de datos.

## Decisión

La aplicación ofrecerá un selector siempre visible en la cabecera con tres preferencias: **Sistema**, **Claro** y **Oscuro**.

- Sin una elección previa, se usará la preferencia del dispositivo.
- La elección se guardará únicamente en `localStorage` del navegador.
- En la preferencia Sistema, la interfaz responderá si cambia el modo del dispositivo mientras la app está abierta.
- La preferencia efectiva se aplicará como `data-theme` en el elemento `html`, incluyendo una aplicación temprana desde `index.html` para evitar un destello del tema incorrecto.

## Interfaz

El selector será un control compacto de tres opciones con iconos y etiquetas accesibles en la cabecera. El modo activo tendrá estado visual y semántico mediante `aria-pressed`.

El tema oscuro mantendrá los acentos verde, amarillo, naranja y azul existentes. Cambiarán los fondos, superficies, bordes y textos de lectura para conservar contraste en paneles, tarjetas, formularios y modales; las tarjetas de equipo y los colores de identidad de los jugadores se preservan.

## Validación

- Verificar que Claro, Oscuro y Sistema apliquen el tema correcto.
- Verificar persistencia tras recargar y respuesta a cambios de preferencia del sistema en modo Sistema.
- Confirmar que el selector se pueda usar por teclado y que los modales, formularios y navegación inferior mantengan contraste legible.
