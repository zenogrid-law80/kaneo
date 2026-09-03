import { eq } from "drizzle-orm";
import db from "../../database";
import { teamMemberTable, teamTable } from "../../database/schema";

async function getWorkspaceTeams(workspaceId: string) {
  const [teams, memberships] = await Promise.all([
    db
      .select({ id: teamTable.id, name: teamTable.name })
      .from(teamTable)
      .where(eq(teamTable.workspaceId, workspaceId)),
    db
      .select({
        teamId: teamMemberTable.teamId,
        userId: teamMemberTable.userId,
      })
      .from(teamMemberTable)
      .innerJoin(teamTable, eq(teamMemberTable.teamId, teamTable.id))
      .where(eq(teamTable.workspaceId, workspaceId)),
  ]);

  const userIdsByTeam = new Map<string, string[]>();
  for (const membership of memberships) {
    const userIds = userIdsByTeam.get(membership.teamId) ?? [];
    userIds.push(membership.userId);
    userIdsByTeam.set(membership.teamId, userIds);
  }

  return teams.map((team) => ({
    ...team,
    userIds: userIdsByTeam.get(team.id) ?? [],
  }));
}

export default getWorkspaceTeams;
