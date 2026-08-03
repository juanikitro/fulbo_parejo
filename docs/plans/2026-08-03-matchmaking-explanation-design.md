# Explicación del armado de equipos

## Objetivo

Mostrar el detalle de la propuesta al presionar el delta de medias entre los equipos. El control debe verse clickeable y el popup explica sólo hechos verificables; no modifica el algoritmo, sus pesos ni sus desempates.

## Decisiones

- El delta de medias es un botón accesible que abre un popup compacto con la diferencia de media operativa y el estado de arqueros.
- Las líneas registradas se resumen sólo cuando existen posiciones no arquero. Sólo se dice que actuaron como ajuste suave si comparar el mismo armado sin esa penalidad cambia el resultado.
- La química aparece sólo si hay pares con cuatro o más partidos compartidos y esos pares, por sí solos, reproducen el resultado final que cambia frente al cálculo sin química.
- En convocatorias impares se identifica al jugador sin asignar. La frase de "mejor preservó el equilibrio" sólo se usa si la diferencia de medias final es mínima frente a todas las alternativas; en otro caso se describe la evaluación sin sobreafirmar.
- El popup reutiliza el patrón de diálogo existente, se cierra por botón o clic fuera y respeta reduced motion.

## Validación

Pruebas unitarias para arqueros, posiciones ausentes, convocatoria impar y química insuficiente; `npm run test`, `npm run build` y revisión en viewport móvil y de escritorio.
