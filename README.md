# Fulbo Matchmaking

Organizador mobile-first de equipos equilibrados con aprendizaje Elo, diseñado para Vercel + Supabase.

## Desarrollo local

1. Copiá `.env.example` como `.env.local` y cargá la URL y la clave publicable de Supabase.
2. En Supabase, configurá Google OAuth con `http://localhost:5173` como URL de redirección para desarrollo y tu dominio de Vercel para producción.
3. Habilitá explícitamente el esquema `public` en Data API para el proyecto y aplicá la migración de `supabase/migrations/`.
4. Ejecutá `npm run dev`.

Sin variables de entorno, la interfaz funciona con un Plantel de demostración local. No usa ni expone claves de servicio.

## Validación

```powershell
npm run test
npm run build
```

Antes de desplegar, revisá las políticas RLS de la migración y verificá las cuotas actuales del proveedor.

## Despliegue de producción

Cada `push` a `main` (incluido un merge de PR) ejecuta `.github/workflows/deploy-production.yml` en serie:

1. instala dependencias, ejecuta tests y genera el build;
2. aplica únicamente las migraciones pendientes en Supabase;
3. publica en Vercel el artefacto generado con las variables de producción.

Configurá estos secretos de GitHub Actions antes del próximo merge:

- `SUPABASE_ACCESS_TOKEN`: token personal de Supabase con acceso al proyecto;
- `SUPABASE_PROJECT_REF`: referencia del proyecto de producción;
- `SUPABASE_DB_PASSWORD`: contraseña de la base de datos de producción;
- `VERCEL_TOKEN`: token de Vercel con acceso al proyecto;
- `VERCEL_ORG_ID` y `VERCEL_PROJECT_ID`: identificadores del equipo y proyecto de Vercel.

El flujo no cancela ejecuciones ya iniciadas para no superponer migraciones. Las migraciones de producción deben ser retrocompatibles: primero expandir el esquema y sólo retirar campos o datos en una entrega posterior y revisada.
