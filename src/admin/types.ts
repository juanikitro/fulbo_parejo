export type AdminAction = 'access' | 'summary' | 'users' | 'user-detail' | 'rosters' | 'roster-detail' | 'matches' | 'match-detail' | 'invitations'
export type AdminSection = 'summary' | 'adoption' | 'users' | 'rosters' | 'matches' | 'invitations'
export type PeriodPreset = 'today' | '7d' | '30d' | '90d' | 'all' | 'custom'

export interface AdminPage<T> { items: T[]; page: number; pageSize: number; total: number; totalPages: number }
export interface AdminPerson { id: string; email: string | null; name: string | null }
export interface AdminRoster { id: string; name: string | null; owner: AdminPerson; createdAt: string | null; updatedAt: string | null; members: number; activePlayers: number; archivedPlayers: number; matches: number; completionRate: number | null; lastMatchAt: string | null; invitations: number; results: number }
export interface AdminUser extends AdminPerson { createdAt: string | null; lastSignInAt: string | null; ownedRoster: Pick<AdminRoster, 'id' | 'name'> | null; rosterCount: number; playersInOwnedRosters: number; matchesInRosters: number; resultsInRosters: number; invitationsSent: number; invitationsAccepted: number }
export interface AdminMatch { id: string; roster: { id: string; name: string }; status: 'confirmed' | 'completed'; teamSize: number; ratingScale: 10 | 100; createdAt: string | null; updatedAt: string | null; participants: number; result: { outcome: string; goalDifference: number | null; recordedAt: string | null } | null }
export interface AdminInvitation { id: string; roster: string; createdAt: string | null; expiresAt: string | null; acceptedAt: string | null; status: 'accepted' | 'pending' | 'expired'; creator: AdminPerson }

export interface AdminSummary {
  range: { preset: PeriodPreset; from: string | null; to: string | null; label: string }
  kpis: Record<'registeredUsers' | 'registeredUsersInPeriod' | 'recentSignIns' | 'rosters' | 'rostersCreated' | 'activePlayers' | 'archivedPlayers' | 'playersPerRoster' | 'matchesCreated' | 'confirmedMatches' | 'completedMatches' | 'completionRate' | 'invitationsCreated' | 'accepted' | 'pending' | 'expired' | 'averageTeamSize', number | null>
  series: Array<{ date: string; users: number; rosters: number; players: number; matches: number; completed: number; invitationsAccepted: number }>
  adoption: { registered: number; rosterActivity: number; rosterWithPlayer: number; rosterWithMatch: number; rosterWithResult: number }
  distributions: { playersPerRoster: Array<{ label: string; count: number }>; positions: Array<{ position: string; count: number }>; withoutPosition: number; ratingScale: Array<{ scale: number; count: number }>; performance: Array<{ label: string; value: number; count: number }>; results: { withResult: number; withoutResult: number; staleConfirmed: number } }
  definitions: Array<{ kind: 'exact' | 'inferred' | 'unavailable'; text: string }>
}

