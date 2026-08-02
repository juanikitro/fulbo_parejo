# Team chemistry

## Goal

Learn which pairs of players perform well together and use that signal, with a
small weight, when proposing balanced teams.

## Source and calculation

Chemistry is derived from completed matches already stored for the roster. A
pair is considered only when both players were on the same team. Each shared
match contributes `+1` for a win, `+0.25` for a draw, and `-1` for a loss.

The pair score is the average of those contributions, damped until the pair
has played four times together. Thus a single result cannot dominate a
proposal, while repeated results make the signal more reliable. Editing or
deleting a historical result naturally changes the next calculation because
no duplicate state is persisted.

## Team balancing

Rating balance, goalkeeper placement, and position balance remain the primary
criteria. Chemistry is a small additional term in the existing optimization:
positive pairs are favored on the same team and negative pairs are discouraged.
It is intentionally bounded so it acts as a gradual tie-breaker rather than
turning an otherwise uneven proposal into a chemistry-based one.

## Interface

The existing Plantel help modal gains a “Química de los equipos” section. It
explains the source of the signal, the result values, and that its precision
improves as the group records more matches. No individual chemistry score is
shown in this first iteration, to avoid presenting early statistical noise as
a definitive judgement about a player.

## Validation

Add focused domain tests for pair scoring, confidence damping, and how positive
or negative chemistry affects equally rated teams. Run the relevant test suite
and the TypeScript/build command without applying database changes.
