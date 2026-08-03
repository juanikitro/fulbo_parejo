# Explicación del armado de equipos

## Objetivo

Agregar una tarjeta secundaria debajo de los equipos que explique, con hechos verificables, por qué se propuso ese armado. No modifica el algoritmo, sus pesos ni sus desempates.

## Decisiones

- La tarjeta siempre muestra la diferencia de media operativa y el estado de arqueros.
- Las líneas registradas se resumen sólo cuando existen posiciones no arquero. Sólo se dice que actuaron como ajuste suave si comparar el mismo armado sin esa penalidad cambia el resultado.
- La química aparece sólo si hay pares con cuatro o más partidos compartidos y esos pares, por sí solos, reproducen el resultado final que cambia frente al cálculo sin química.
- En convocatorias impares se identifica al jugador sin asignar. La frase de "mejor preservó el equilibrio" sólo se usa si la diferencia de medias final es mínima frente a todas las alternativas; en otro caso se describe la evaluación sin sobreafirmar.
- El detalle usa el elemento nativo `details`, cerrado por defecto, sin animaciones nuevas.

## Validación

Pruebas unitarias para arqueros, posiciones ausentes, convocatoria impar y química insuficiente; `npm run test`, `npm run build` y revisión en viewport móvil y de escritorio.
