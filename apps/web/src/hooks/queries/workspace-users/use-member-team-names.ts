import { useMemo } from "react";
import useWorkspaceTeams from "@/hooks/queries/workspace/use-workspace-teams";

function useMemberTeamNames(workspaceId: string) {
  const query = useWorkspaceTeams(workspaceId);
  const namesByUserId = useMemo(() => {
    const names: Record<string, string[]> = {};
    for (const team of query.data ?? []) {
      for (const userId of team.userIds) {
        names[userId] ??= [];
        names[userId].push(team.name);
      }
    }
    return names;
  }, [query.data]);

  return {
    ...query,
    data: namesByUserId,
  };
}

export default useMemberTeamNames;
