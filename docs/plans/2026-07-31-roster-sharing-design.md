# Shared roster invitations

Owners can create a one-time invitation URL that expires after seven days. An authenticated recipient accepts it and becomes an editor of that roster.

Editors can access the roster, players, matches, participants, results, and Elo history. The owner remains the only account allowed to create invitations. Database functions hash tokens, atomically consume invitations, and RLS policies permit access only to the owner or an accepted member.
