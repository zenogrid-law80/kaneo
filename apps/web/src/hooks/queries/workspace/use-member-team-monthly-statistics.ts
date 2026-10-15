import { useQuery } from "@tanstack/react-query";
import getMemberTeamMonthlyStatistics from "@/fetchers/workspace/get-member-team-monthly-statistics";

function useMemberTeamMonthlyStatistics(
  workspaceId: string,
  projectId?: string,
  startDate?: string,
  endDate?: string,
  milestoneId?: string,
  includeSupportingAssignees = false,
) {
  return useQuery({
    queryKey: [
      "member-team-monthly-statistics",
      workspaceId,
      projectId,
      startDate,
      endDate,
      milestoneId,
      includeSupportingAssignees,
    ],
    queryFn: () =>
      getMemberTeamMonthlyStatistics(
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

export default useMemberTeamMonthlyStatistics;
