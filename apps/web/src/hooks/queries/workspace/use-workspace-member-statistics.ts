import { useQuery } from "@tanstack/react-query";
import getWorkspaceMemberStatistics from "@/fetchers/workspace/get-workspace-member-statistics";

export const workspaceMemberStatisticsQueryKey = (
  workspaceId: string,
  projectId?: string,
  startDate?: string,
  endDate?: string,
  milestoneId?: string,
  includeSupportingAssignees = false,
) =>
  [
    "workspace-member-statistics",
    workspaceId,
    projectId,
    startDate,
    endDate,
    milestoneId,
    includeSupportingAssignees,
  ] as const;

function useWorkspaceMemberStatistics(
  workspaceId: string,
  projectId?: string,
  startDate?: string,
  endDate?: string,
  milestoneId?: string,
  includeSupportingAssignees = false,
) {
  return useQuery({
    queryKey: workspaceMemberStatisticsQueryKey(
      workspaceId,
      projectId,
      startDate,
      endDate,
      milestoneId,
      includeSupportingAssignees,
    ),
    queryFn: () =>
      getWorkspaceMemberStatistics(
        workspaceId,
        projectId,
        startDate,
        endDate,
        milestoneId,
        includeSupportingAssignees,
      ),
    enabled: Boolean(workspaceId),
  });
}

export default useWorkspaceMemberStatistics;
