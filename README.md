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
