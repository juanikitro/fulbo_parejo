# Shared board movement indicators

## Goal

Make the shared match image explain each player's most recent Elo movement without changing ratings or stored data.

## Approved design

- Replace `PARTIDO ARMADO` with the FulboParejo wordmark: `Fulbo` in white and `Parejo` in red.
- Draw the current roster name below the wordmark.
- In each team's roster list, draw the latest non-zero offset immediately after the player's name: green `↑ +0.18` or red `↓ -0.12`.
- Keep players with no completed match or a zero offset as name-only entries.
- Carry the orange/blue team color into a small list accent.
- Increase the canvas height and vertical spacing between the roster lists and their team cards.

## Data flow and risks

`latestOffsets` already contains the last completed-match offset per player. The share renderer will receive that map, while the fallback share text stays unchanged. No database, Elo calculation, or schema changes are needed.

The generated canvas has fixed drawing coordinates, so offsets and longer roster names need a focused rendering test plus a build check.
