# Callup position groups

## Goal

Make the callup selector easier to scan by presenting players in football-position lines.

## Approved design

Keep the existing horizontally scrollable, three-row selector and selection behavior. Render groups in this order: Porteros, Defensores, Mediocampistas, Delanteros, and Sin posición. Each non-empty group has a subtle label styled like the confirmation counter and a thin divider underneath. Empty groups are omitted.

## Data and behavior

Grouping derives from each player's existing `preferredPosition`; no data migration or selection-state change is needed. Players without that value appear only in the final group.

## Validation

Add a focused grouping test and run the relevant test command. Verify the selector manually in both themes if a local browser is available.
