# Social preview de Fulbo Parejo

## Objetivo

Que al compartir la URL pública se identifique como **Fulbo Parejo** y muestre una miniatura de fútbol en clientes que leen Open Graph.

## Diseño aprobado

- Conservar el favicon inline para pestañas del navegador.
- Cambiar el título HTML a `Fulbo Parejo`.
- Añadir `description`, Open Graph y Twitter Card con la URL canónica.
- Publicar una imagen raster de cancha y pelota en `public/og-image.png` para los rastreadores sociales.

## Validación

Comprobar el HTML construido y que la imagen quede en `dist/og-image.png`. Tras publicar, los previews existentes pueden requerir que WhatsApp o la red social actualice su caché.
