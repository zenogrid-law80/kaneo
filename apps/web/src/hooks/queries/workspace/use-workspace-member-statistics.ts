import { useQuery } from "@tanstack/react-query";
import getWorkspaceMemberStatistics from "@/fetchers/workspace/get-workspace-member-statistics";

export const workspaceMemberStatisticsQueryKey = (
  workspaceId: string,
  projectId?: string,
  startDate?: string,
  endDate?: string,
) =>
  [
    "workspace-member-statistics",
    workspaceId,
    projectId,
    startDate,
    endDate,
  ] as const;

function useWorkspaceMemberStatistics(
  workspaceId: string,
  projectId?: string,
  startDate?: string,
  endDate?: string,
) {
  return useQuery({
    queryKey: workspaceMemberStatisticsQueryKey(
      workspaceId,
      projectId,
      startDate,
      endDate,
    ),
    queryFn: () =>
      getWorkspaceMemberStatistics(workspaceId, projectId, startDate, endDate),
    enabled: Boolean(workspaceId),
  });
}

export default useWorkspaceMemberStatistics;
