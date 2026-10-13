import { useQuery } from "@tanstack/react-query";
import getWorkspaceMemberStatistics from "@/fetchers/workspace/get-workspace-member-statistics";

export const workspaceMemberStatisticsQueryKey = (
  workspaceId: string,
  projectId?: string,
  startDate?: string,
  endDate?: string,
  milestoneId?: string,
) =>
  [
    "workspace-member-statistics",
    workspaceId,
    projectId,
    startDate,
    endDate,
    milestoneId,
  ] as const;

function useWorkspaceMemberStatistics(
  workspaceId: string,
  projectId?: string,
  startDate?: string,
  endDate?: string,
  milestoneId?: string,
) {
  return useQuery({
    queryKey: workspaceMemberStatisticsQueryKey(
      workspaceId,
      projectId,
      startDate,
      endDate,
      milestoneId,
    ),
    queryFn: () =>
      getWorkspaceMemberStatistics(
        workspaceId,
        projectId,
        startDate,
        endDate,
        milestoneId,
      ),
    enabled: Boolean(workspaceId),
  });
}

export default useWorkspaceMemberStatistics;
