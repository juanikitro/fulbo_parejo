# Modal de instalación y controles móviles

## Objetivo

Evitar que el modal de instalación quede debajo de la navegación móvil y dar coherencia visual a los controles del encabezado.

## Diseño aprobado

- El modal de instalación se presenta sobre la navegación fija, con alto máximo, scroll interno y acciones siempre visibles.
- Los controles del encabezado pasan a una grilla de botones cuadrados con SVG de trazo redondeado común.
- Instalar usa un ícono de descarga; ayuda muestra una `i` dentro de un círculo.
- Tema, administración, acceso al plantel y salida se adaptan a la misma escala y estilo.

## Verificación

- Tests PWA focalizados y compilación en CI.
- Inspección visual en viewport móvil antes de publicar.
