# Botón de feedback por WhatsApp

## Objetivo

Ofrecer, junto al enlace de Cafecito del pie de la aplicación, una vía directa para enviar sugerencias o reportar errores.

## Diseño aprobado

- Se conserva el enlace de Cafecito y se agrega a su lado un segundo enlace.
- El nuevo enlace usa el logo reconocible de WhatsApp, el texto «Mandanos tu idea» y abre una conversación con el número `5492345455007`.
- El mensaje inicial explica que el canal sirve para sugerencias y bugs de Fulbo Parejo.
- Ambos enlaces mantienen el mismo tamaño, foco accesible y adaptación en pantallas angostas.

## Alcance y validación

El cambio se limita al footer y sus estilos. Se verificará el diff, el formato de Git y que la URL construida sea correcta; no se modificarán datos ni configuración de la aplicación.
