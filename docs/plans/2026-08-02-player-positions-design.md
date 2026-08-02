# Player positions

## Goal

Replace the generic player-position selector with a horizontally scrollable
position picker and use the selected football role when balancing teams.

## Positions

The persisted codes are `PO`, `DFI`, `DFC`, `DFD`, `MC`, `MD`, `MI`, `DC`,
`EI`, and `ED`. The migration converts existing values as follows:
`goalkeeper` to `PO`, `defender` to `DFC`, `midfielder` to `MC`, and `forward`
to `DC`.

## Team balancing

The matcher keeps rating balance as its primary goal, requires one goalkeeper
per team when two or more goalkeepers are called up, and applies a larger soft
penalty for an imbalance by line (defence, midfield, attack) than for a
specific non-goalkeeper role. This makes positions materially influence the
proposal without making common uneven call-ups impossible to balance.

## Interface

The player modal renders the ten roles and the optional "Sin posición" value
as accessible buttons in the existing horizontally scrolling picker style.
The pitch groups the roles into goalkeeper, defence, midfield, and attack
rows; compatible automatic swaps prefer the exact role and then the same line.

## Validation

Add focused matcher tests, run the project test suite and production build,
and inspect the migration SQL without applying it to a remote database.
