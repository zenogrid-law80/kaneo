import { useQuery } from "@tanstack/react-query";
import getWorkspaceTeams from "@/fetchers/workspace/get-workspace-teams";

export type WorkspaceTeam = {
  id: string;
  name: string;
  userIds: string[];
};

export const workspaceTeamsQueryKey = (workspaceId?: string) =>
  workspaceId
    ? (["workspace-teams", "with-members", workspaceId] as const)
    : (["workspace-teams"] as const);

function useWorkspaceTeams(workspaceId: string) {
  return useQuery({
    queryKey: workspaceTeamsQueryKey(workspaceId),
    enabled: Boolean(workspaceId),
    refetchOnMount: "always",
    queryFn: () => getWorkspaceTeams(workspaceId),
  });
}

export default useWorkspaceTeams;
