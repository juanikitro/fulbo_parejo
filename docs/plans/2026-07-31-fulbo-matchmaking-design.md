# Fulbo Matchmaking — Diseño aprobado

## Objetivo

Aplicación pública mobile-first para que cada cuenta organice un plantel privado de fútbol, arme dos equipos equilibrados y aprenda de los resultados de los partidos.

## Arquitectura

- SPA React/Vite servida por CDN en Vercel.
- Supabase para PostgreSQL y autenticación con Google.
- Una Cuenta posee un único Plantel privado.
- RLS protege todas las filas por cuenta propietaria.
- El armado se calcula localmente con el Plantel cargado; el backend persiste el armado confirmado, los resultados y los recálculos.
- No hay soporte offline inicial.
- JSON es un formato de exportación versionado, no la persistencia principal.

## Modelo de dominio

- Un Jugador tiene nombre, valoración base obligatoria de 1 a 10, posición preferida opcional, icono y color de un catálogo, estado activo/archivado y Semilla Elo.
- Las posiciones son Arquero, Defensor, Mediocampista y Delantero.
- La valoración aprendida se inicia igual a la base y se muestra con dos decimales.
- La valoración operativa para el armado pondera 40% la base y 60% la aprendida.
- Cambiar la valoración base no borra la aprendida ni cambia la Semilla Elo.
- Un Partido conserva los equipos realmente confirmados, incluso tras intercambios manuales.
- Un Resultado puede tener ganador, empate y diferencia de goles opcional.
- Corregir un resultado reconstruye las valoraciones aprendidas recorriendo el historial desde las Semillas Elo.

## Matchmaking

- Forma dos equipos del mismo tamaño usando los Convocados de una fecha.
- Acepta cualquier cantidad par. Con cantidad impar, deja un Convocado no asignado priorizando el equilibrio de fuerza.
- Si hay dos o más arqueros disponibles, asigna exactamente uno por equipo.
- Si hay un único arquero, el equipo sin arquero recibe una compensación de fuerza.
- Las posiciones de campo aplican una penalización suave contra distribuciones extremas, sin sobreponerse al equilibrio de fuerza.
- El aprendizaje usa Elo simplificado: premia las sorpresas y modula moderadamente el ajuste por diferencia de goles cuando existe.

## Interfaz

- Navegación inferior mobile-first: Plantel, Nuevo partido e Historial.
- Flujo: seleccionar convocados, generar equipos, intercambiar jugadores, confirmar, registrar resultado.
- El armado muestra fuerza/media por equipo, diferencia, arqueros y explicación de posiciones.
- La cancha es una vista exclusivamente frontend: no participa del balance ni se edita.
- Layouts específicos para 5, 6, 8 y 11 jugadores por equipo; formación genérica para otras cantidades pares.
- Estilo: arcade deportivo moderno. Cancha con grilla nítida, fichas de jugador, marcador de estilo arcade y tipografía de datos legible; no pixel art borroso ni estética infantil.
- Iconos y colores de jugador provienen de un catálogo fijo; fotos de perfil quedan fuera de alcance.

## Exportaciones

- Descarga de JSON versionado con Plantel, Jugadores, Partidos, Resultados y valoraciones.
- En mobile, compartir el armado confirmado mediante la hoja nativa con texto `Equipo 1 vs Equipo 2` e imagen de la cancha; descarga/copiar como fallback.
- No habrá importación JSON en la primera versión.

## Estados y validación

- Estados: plantel vacío, pocos convocados, posición ausente, falta de dos arqueros, carga, error de guardado, resultado incompleto y partido corregido.
- Pruebas de algoritmo: par/impar, arqueros, penalización posicional, intercambios, Elo, empates, diferencia de goles y reproducción desde la Semilla Elo.
- Pruebas de seguridad: aislamiento RLS entre cuentas.
- Pruebas de experiencia: flujo mobile completo, exportación JSON y compartir/descargar el resumen.

## Riesgos conocidos

- Límites y latencia ocasional de planes gratuitos de Vercel/Supabase.
- Las cuotas y APIs actuales deben verificarse en documentación oficial antes de implementar la integración.
- No exponer claves de servicio en el cliente; toda tabla pública debe usar RLS con ownership por cuenta.
