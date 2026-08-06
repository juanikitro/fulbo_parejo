# Player and roster statistics design

## Goal

Give each roster a clear historical summary and give each player a readable personal progression, without adding navigation or persisting derived metrics.

## Experience

The existing **Historial** screen gains a compact **Resumen del plantel** above the match list. It shows outcomes across the loaded history (Claro won, draws, and Oscuro won), a centered goal-difference chart, and the three largest positive and negative player rating changes.

The existing player detail modal gains a cumulative Elo progression line, wins/draws/losses, net rating change, and concise recent-trend wording. Charts are responsive SVGs with text and accessible labels. With insufficient history, the UI explains that no trend can yet be inferred.

## Data and behavior

All values derive from the existing match and player histories. The feature adds no migration, table, or persisted aggregate. Loading earlier matches extends the roster summary; record/edit/delete refreshes the already queried histories and summaries.

## Validation

Unit tests cover chronological series construction, result aggregation, net offsets, recent trend wording, and single-match behavior. The full test suite and production build must pass.
