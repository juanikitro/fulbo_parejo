# Reusable roster invitation links

Each invitation URL can add any number of authenticated accounts to the invited roster until it expires. New links expire three days after creation; existing links retain their stored expiration.

Acceptance remains idempotent per account through `roster_access`. The invitation record keeps its first-use timestamp for administration, but its accepted state no longer prevents later accounts from using the same unexpired link.
