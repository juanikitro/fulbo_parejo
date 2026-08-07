# Balanced player swap design

The automatic player swap evaluates every opponent with the same goalkeeper status as the selected player. It selects the candidate that minimizes the difference between the resulting team averages.

When candidates produce equal averages, it prefers the same preferred position, then the closest operational rating. Goalkeepers and field players are never interchanged automatically.
