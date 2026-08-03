# Panel administrativo de Fulbo Parejo

## Objetivo

Panel interno, de solo lectura, disponible en `#/admin` para personas con el rol privado `superadmin`. Usa únicamente datos existentes y no incorpora telemetría de navegación.

## Seguridad y flujo

`public.admin_users` mantiene el rol con RLS activado, sin permisos ni políticas para `anon` o `authenticated`. La Edge Function `admin-metrics` exige un JWT de usuario, consulta ese rol con credenciales de servidor y sólo entonces accede a datos administrativos, incluido `auth.users`. El navegador nunca recibe ni usa secretos, hashes de invitación o acceso directo a `auth.users`.

El cliente consulta primero `access`. El botón compacto de tablero sólo aparece tras una respuesta afirmativa; la ruta sigue protegida aunque se escriba manualmente. Sin sesión se conserva el ingreso normal; una sesión no autorizada ve el mensaje de acceso denegado sin datos.

## Datos y UX

La Function devuelve DTOs agregados o páginas limitadas para resumen, usuarios, planteles, partidos e invitaciones. El resumen etiqueta registros como exactos y el embudo/actividad como inferidos cuando el esquema no conserva quién ejecutó una acción dentro de un plantel compartido. Los gráficos son SVG nativo y cada sección conserva estados de carga, error y vacío.

No se aplicará la migración ni se desplegará como parte de este cambio.

