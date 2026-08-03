# Player chemistry detail design

## Goal

Expose each player's chemistry data from their existing detail modal without changing how a match is generated.

## Experience

The modal opens on **Historial**, preserving the current view of match history and performance. A two-option toggle lets the user switch to **Química**.

The chemistry view presents two ranked lists:

- **Mejor química**: teammates with the highest shared-team chemistry.
- **Menor química**: teammates with the lowest shared-team chemistry.

Each row contains the teammate identity, the chemistry value, and the number of matches played together. Pairs with fewer than four shared matches remain visible and are labeled **Poca evidencia**. If the player has no shared-team history, the view states that clearly.

The two rankings are mutually exclusive: a teammate shown in **Mejor química** is excluded from **Menor química**, and vice versa.

## Data and behavior

The feature derives its information from the chemistry match history already loaded by the app. It must add no database schema, persistence, or matchmaking changes. The calculation will expose the pair score plus the shared-match count, then the UI will filter it to the selected player and sort it in both directions.

## Validation

Focused tests will cover aggregation and ordering, the low-evidence marker, and the empty state. The existing player-detail behavior remains covered by its current tests.
