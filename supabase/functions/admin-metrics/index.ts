import "@supabase/functions-js/edge-runtime.d.ts";
import { createSupabaseContext } from "@supabase/server";

type Action = "access" | "summary" | "users" | "user-detail" | "rosters" | "roster-detail" | "matches" | "match-detail" | "invitations";
type Row = Record<string, unknown>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
});

const asRows = (value: unknown): Row[] => Array.isArray(value) ? value as Row[] : [];
const day = (value: unknown) => typeof value === "string" ? value.slice(0, 10) : "";
const number = (value: unknown) => Number(value ?? 0);
const string = (value: unknown) => typeof value === "string" ? value : null;
const unique = <T>(values: T[]) => [...new Set(values)];
const displayName = (user: Row | undefined) => {
  const metadata = user?.user_metadata as Row | undefined;
  return string(metadata?.full_name) ?? string(metadata?.name) ?? null;
};
const statusForInvitation = (invitation: Row, now: number) => invitation.accepted_at ? "accepted" : new Date(String(invitation.expires_at)).getTime() <= now ? "expired" : "pending";
const inRange = (value: unknown, from: string | null, to: string | null) => {
  const valueDay = day(value);
  return Boolean(valueDay && (!from || valueDay >= from) && (!to || valueDay < to));
};
const pageOf = <T>(items: T[], page: number, pageSize: number) => ({ items: items.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: items.length, totalPages: Math.max(1, Math.ceil(items.length / pageSize)) });

async function loadAllUsers(admin: any) {
  const users: Row[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    users.push(...(data.users as Row[]));
    if (data.users.length < 100) break;
  }
  return users;
}

async function loadDataset(admin: any) {
  const [users, rosters, members, players, matches, participants, results, invitations] = await Promise.all([
    loadAllUsers(admin),
    admin.from("rosters").select("id, owner_id, name, created_at, updated_at"),
    admin.from("roster_members").select("roster_id, user_id, created_at"),
    admin.from("players").select("id, roster_id, name, archived_at, preferred_position, icon, color, base_rating, learned_rating, elo_seed, created_at, updated_at"),
    admin.from("matches").select("id, roster_id, team_size, status, rating_scale, created_at, updated_at"),
    admin.from("match_participants").select("match_id, player_id, team, ordinal, rating_offset, performance_rating"),
    admin.from("match_results").select("match_id, outcome, goal_difference, recorded_at"),
    admin.from("roster_invitations").select("id, roster_id, expires_at, accepted_at, accepted_by, created_by, created_at"),
  ]);
  for (const response of [rosters, members, players, matches, participants, results, invitations]) if (response.error) throw response.error;
  return { users, rosters: asRows(rosters.data), members: asRows(members.data), players: asRows(players.data), matches: asRows(matches.data), participants: asRows(participants.data), results: asRows(results.data), invitations: asRows(invitations.data) };
}

function period(body: Row) {
  const preset = string(body.preset) ?? "30d";
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const end = new Date(today); end.setUTCDate(end.getUTCDate() + 1);
  const offset = preset === "today" ? 0 : preset === "7d" ? 6 : preset === "30d" ? 29 : preset === "90d" ? 89 : null;
  if (preset === "all") return { preset, from: null, to: null, label: "Histórico" };
  if (preset === "custom") return { preset, from: string(body.from), to: string(body.to), label: "Rango personalizado" };
  const start = new Date(today); start.setUTCDate(start.getUTCDate() - (offset ?? 29));
  return { preset, from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10), label: preset === "today" ? "Hoy" : `Últimos ${(offset ?? 29) + 1} días` };
}

function makeSummary(data: Awaited<ReturnType<typeof loadDataset>>, body: Row) {
  const range = period(body), now = Date.now();
  const byRoster = <T extends Row>(rows: T[]) => new Map(data.rosters.map((roster) => [String(roster.id), rows.filter((row) => row.roster_id === roster.id)]));
  const rosterPlayers = byRoster(data.players), rosterMatches = byRoster(data.matches), rosterInvitations = byRoster(data.invitations);
  const resultMatchIds = new Set(data.results.map((result) => result.match_id));
  const filtered = (rows: Row[], field = "created_at") => rows.filter((row) => inRange(row[field], range.from, range.to));
  const userCreated = filtered(data.users, "created_at"), rostersCreated = filtered(data.rosters), playersCreated = filtered(data.players), matchesCreated = filtered(data.matches), invitationsCreated = filtered(data.invitations);
  const completedCreated = matchesCreated.filter((match) => match.status === "completed");
  const acceptedCreated = invitationsCreated.filter((invite) => invite.accepted_at);
  const statusCounts = { accepted: 0, pending: 0, expired: 0 };
  for (const invite of invitationsCreated) statusCounts[statusForInvitation(invite, now) as keyof typeof statusCounts] += 1;
  const activePlayers = data.players.filter((player) => !player.archived_at);
  const seriesDates = unique([
    ...userCreated.map((row) => day(row.created_at)), ...rostersCreated.map((row) => day(row.created_at)), ...playersCreated.map((row) => day(row.created_at)), ...matchesCreated.map((row) => day(row.created_at)), ...data.matches.filter((row) => row.status === "completed" && inRange(row.updated_at, range.from, range.to)).map((row) => day(row.updated_at)), ...data.invitations.filter((row) => row.accepted_at && inRange(row.accepted_at, range.from, range.to)).map((row) => day(row.accepted_at)),
  ].filter(Boolean)).sort();
  const countByDay = (rows: Row[], field: string) => Object.fromEntries(seriesDates.map((date) => [date, rows.filter((row) => day(row[field]) === date).length]));
  const positions = ["goalkeeper", "defender", "midfielder", "forward"];
  const performance = ["Muy mal", "Mal", "Normal", "Bien", "Muy bien"].map((label, index) => ({ label, value: index - 2, count: data.participants.filter((row) => number(row.performance_rating) === index - 2).length }));
  const staleConfirmed = data.matches.filter((match) => match.status === "confirmed" && new Date(String(match.created_at)).getTime() < now - 7 * 86400000).length;
  const playerRosterIds = new Set(data.players.map((player) => player.roster_id));
  const matchRosterIds = new Set(data.matches.map((match) => match.roster_id));
  const resultRosterIds = new Set(data.matches.filter((match) => resultMatchIds.has(match.id)).map((match) => match.roster_id));
  return {
    range,
    kpis: {
      registeredUsers: data.users.length, registeredUsersInPeriod: userCreated.length, recentSignIns: data.users.filter((user) => inRange(user.last_sign_in_at, range.from, range.to)).length,
      rosters: data.rosters.length, rostersCreated: rostersCreated.length, activePlayers: activePlayers.length, archivedPlayers: data.players.length - activePlayers.length,
      playersPerRoster: data.rosters.length ? Number((activePlayers.length / data.rosters.length).toFixed(1)) : 0, matchesCreated: matchesCreated.length,
      confirmedMatches: matchesCreated.filter((match) => match.status === "confirmed").length, completedMatches: completedCreated.length,
      completionRate: matchesCreated.length ? Number((completedCreated.length / matchesCreated.length * 100).toFixed(1)) : null,
      invitationsCreated: invitationsCreated.length, ...statusCounts,
      averageTeamSize: matchesCreated.length ? Number((matchesCreated.reduce((sum, match) => sum + number(match.team_size), 0) / matchesCreated.length).toFixed(1)) : null,
    },
    series: seriesDates.map((date) => ({ date, users: countByDay(userCreated, "created_at")[date], rosters: countByDay(rostersCreated, "created_at")[date], players: countByDay(playersCreated, "created_at")[date], matches: countByDay(matchesCreated, "created_at")[date], completed: countByDay(data.matches.filter((row) => row.status === "completed"), "updated_at")[date], invitationsAccepted: countByDay(data.invitations.filter((row) => row.accepted_at), "accepted_at")[date] })),
    adoption: { registered: data.users.length, rosterActivity: data.rosters.length, rosterWithPlayer: playerRosterIds.size, rosterWithMatch: matchRosterIds.size, rosterWithResult: resultRosterIds.size },
    distributions: {
      playersPerRoster: [0, 1, 2, 3, 4, 5, 6].map((min) => ({ label: min === 6 ? "6 o más" : String(min), count: data.rosters.filter((roster) => { const count = rosterPlayers.get(String(roster.id))?.filter((player) => !player.archived_at).length ?? 0; return min === 6 ? count >= min : count === min }).length })),
      positions: positions.map((position) => ({ position, count: activePlayers.filter((player) => player.preferred_position === position).length })), withoutPosition: activePlayers.filter((player) => !player.preferred_position).length,
      ratingScale: [10, 100].map((scale) => ({ scale, count: data.matches.filter((match) => number(match.rating_scale) === scale).length })),
      performance,
      results: { withResult: resultMatchIds.size, withoutResult: data.matches.length - resultMatchIds.size, staleConfirmed },
    },
    definitions: [
      { kind: "exact", text: "Registros, planteles, jugadores, partidos, resultados e invitaciones se cuentan desde sus tablas persistidas." },
      { kind: "exact", text: "Último acceso usa last_sign_in_at de Auth cuando está disponible; no equivale a uso activo diario." },
      { kind: "inferred", text: "El embudo representa actividad persistida del plantel. En un plantel compartido no se atribuye un partido o resultado a una persona concreta." },
      { kind: "unavailable", text: "No existen eventos para medir aperturas de la app, usuarios activos diarios ni sesiones de producto." },
    ],
  };
}

function userRows(data: Awaited<ReturnType<typeof loadDataset>>) {
  const resultsByMatch = new Set(data.results.map((result) => result.match_id));
  return data.users.map((user) => {
    const id = String(user.id), owned = data.rosters.filter((roster) => roster.owner_id === id), member = data.members.filter((entry) => entry.user_id === id);
    const participantRosterIds = unique([...owned.map((roster) => String(roster.id)), ...member.map((entry) => String(entry.roster_id))]);
    const matches = data.matches.filter((match) => participantRosterIds.includes(String(match.roster_id)));
    return { id, email: string(user.email), name: displayName(user), createdAt: string(user.created_at), lastSignInAt: string(user.last_sign_in_at), ownedRoster: owned[0] ? { id: owned[0].id, name: owned[0].name } : null, rosterCount: participantRosterIds.length, playersInOwnedRosters: data.players.filter((player) => owned.some((roster) => roster.id === player.roster_id)).length, matchesInRosters: matches.length, resultsInRosters: matches.filter((match) => resultsByMatch.has(match.id)).length, invitationsSent: data.invitations.filter((invite) => invite.created_by === id).length, invitationsAccepted: data.invitations.filter((invite) => invite.accepted_by === id).length };
  });
}

function rosterRows(data: Awaited<ReturnType<typeof loadDataset>>) {
  const users = new Map(data.users.map((user) => [String(user.id), user]));
  const resultsByMatch = new Set(data.results.map((result) => result.match_id));
  return data.rosters.map((roster) => {
    const players = data.players.filter((player) => player.roster_id === roster.id), matches = data.matches.filter((match) => match.roster_id === roster.id), completed = matches.filter((match) => match.status === "completed");
    return { id: String(roster.id), name: string(roster.name), owner: { id: roster.owner_id, email: string(users.get(String(roster.owner_id))?.email), name: displayName(users.get(String(roster.owner_id))) }, createdAt: string(roster.created_at), updatedAt: string(roster.updated_at), members: data.members.filter((member) => member.roster_id === roster.id).length, activePlayers: players.filter((player) => !player.archived_at).length, archivedPlayers: players.filter((player) => player.archived_at).length, matches: matches.length, completionRate: matches.length ? Number((completed.length / matches.length * 100).toFixed(1)) : null, lastMatchAt: matches.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0]?.created_at ?? null, invitations: data.invitations.filter((invite) => invite.roster_id === roster.id).length, results: matches.filter((match) => resultsByMatch.has(match.id)).length };
  });
}

function matchRows(data: Awaited<ReturnType<typeof loadDataset>>) {
  const rosters = new Map(data.rosters.map((roster) => [String(roster.id), roster]));
  const results = new Map(data.results.map((result) => [String(result.match_id), result]));
  return data.matches.map((match) => ({ id: String(match.id), roster: { id: match.roster_id, name: rosters.get(String(match.roster_id))?.name ?? "Plantel eliminado" }, status: match.status, teamSize: number(match.team_size), ratingScale: number(match.rating_scale), createdAt: string(match.created_at), updatedAt: string(match.updated_at), participants: data.participants.filter((participant) => participant.match_id === match.id).length, result: results.get(String(match.id)) ? { outcome: results.get(String(match.id))?.outcome, goalDifference: results.get(String(match.id))?.goal_difference, recordedAt: results.get(String(match.id))?.recorded_at } : null }));
}

export default {
  fetch: async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    const { data: ctx, error } = await createSupabaseContext(req, { auth: "user" });
    if (error || !ctx?.userClaims?.id) return json({ message: "Iniciá sesión para acceder a esta sección." }, 401);
    const body = (await req.json().catch(() => ({}))) as Row;
    const action = string(body.action) as Action | null;
    if (!action) return json({ message: "Solicitud administrativa inválida." }, 400);
    const { data: adminRole, error: roleError } = await ctx.supabaseAdmin.from("admin_users").select("role").eq("user_id", ctx.userClaims.id).eq("role", "superadmin").maybeSingle();
    if (roleError) return json({ message: "No se pudo verificar el permiso." }, 500);
    if (!adminRole) return json({ message: "No tenés permiso para acceder a esta sección." }, 403);
    if (action === "access") return json({ isAdmin: true, role: "superadmin" });
    try {
      const data = await loadDataset(ctx.supabaseAdmin);
      if (action === "summary") return json(makeSummary(data, body));
      const page = Math.max(1, Math.floor(number(body.page) || 1)), pageSize = Math.min(50, Math.max(10, Math.floor(number(body.pageSize) || 20))), query = (string(body.query) ?? "").trim().toLowerCase();
      if (action === "users") {
        const rows = userRows(data).filter((row) => !query || [row.email, row.name].some((value) => value?.toLowerCase().includes(query))).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        return json(pageOf(rows, page, pageSize));
      }
      if (action === "user-detail") {
        const row = userRows(data).find((user) => user.id === string(body.id));
        if (!row) return json({ message: "Usuario no encontrado." }, 404);
        const ids = new Set([...data.rosters.filter((roster) => roster.owner_id === row.id).map((roster) => roster.id), ...data.members.filter((member) => member.user_id === row.id).map((member) => member.roster_id)]);
        return json({ ...row, rosters: rosterRows(data).filter((roster) => ids.has(roster.id)) });
      }
      if (action === "rosters") return json(pageOf(rosterRows(data).filter((row) => !query || [row.name, row.owner.email, row.owner.name].some((value) => value?.toLowerCase().includes(query))).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))), page, pageSize));
      if (action === "roster-detail") {
        const roster = data.rosters.find((entry) => entry.id === string(body.id)); if (!roster) return json({ message: "Plantel no encontrado." }, 404);
        const users = new Map(data.users.map((user) => [String(user.id), user]));
        return json({ ...rosterRows(data).find((row) => row.id === roster.id), members: [roster.owner_id, ...data.members.filter((member) => member.roster_id === roster.id).map((member) => member.user_id)].map((id) => ({ id, email: string(users.get(String(id))?.email), name: displayName(users.get(String(id))) })), players: data.players.filter((player) => player.roster_id === roster.id).map((player) => ({ id: player.id, name: player.name, archived: Boolean(player.archived_at), position: player.preferred_position, icon: player.icon, color: player.color, baseRating: player.base_rating, learnedRating: player.learned_rating })), matches: matchRows(data).filter((match) => match.roster.id === roster.id).slice(0, 10) });
      }
      if (action === "matches") {
        const filters = (body.filters ?? {}) as Row; let rows = matchRows(data).filter((row) => inRange(row.createdAt, string(filters.from), string(filters.to)));
        if (filters.status) rows = rows.filter((row) => row.status === filters.status); if (filters.rosterId) rows = rows.filter((row) => row.roster.id === filters.rosterId); if (filters.ratingScale) rows = rows.filter((row) => row.ratingScale === number(filters.ratingScale)); if (filters.teamSize) rows = rows.filter((row) => row.teamSize === number(filters.teamSize));
        return json(pageOf(rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))), page, pageSize));
      }
      if (action === "match-detail") {
        const match = matchRows(data).find((entry) => entry.id === string(body.id)); if (!match) return json({ message: "Partido no encontrado." }, 404);
        const players = new Map(data.players.map((player) => [String(player.id), player]));
        return json({ ...match, teams: [1, 2].map((team) => data.participants.filter((participant) => participant.match_id === match.id && number(participant.team) === team).sort((a, b) => number(a.ordinal) - number(b.ordinal)).map((participant) => ({ player: { id: participant.player_id, name: players.get(String(participant.player_id))?.name ?? "Jugador eliminado", position: players.get(String(participant.player_id))?.preferred_position ?? null }, ratingOffset: participant.rating_offset, performanceRating: participant.performance_rating }))) });
      }
      if (action === "invitations") {
        const invitationFilters = (body.filters ?? {}) as Row;
        const rows = data.invitations.map((invite) => ({ id: invite.id, roster: data.rosters.find((roster) => roster.id === invite.roster_id)?.name ?? "Plantel eliminado", createdAt: invite.created_at, expiresAt: invite.expires_at, acceptedAt: invite.accepted_at, status: statusForInvitation(invite, Date.now()), creator: { id: invite.created_by, email: string(data.users.find((user) => user.id === invite.created_by)?.email), name: displayName(data.users.find((user) => user.id === invite.created_by)) } })).filter((row) => (!query || [row.roster, row.creator.email, row.creator.name].some((value) => value?.toLowerCase().includes(query))) && (!invitationFilters.status || row.status === invitationFilters.status)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        return json(pageOf(rows, page, pageSize));
      }
      return json({ message: "Consulta administrativa desconocida." }, 400);
    } catch (exception) {
      console.error("admin-metrics failed", action, exception instanceof Error ? exception.message : "unknown");
      return json({ message: "No se pudieron cargar los datos administrativos. Intentá de nuevo." }, 500);
    }
  },
};

