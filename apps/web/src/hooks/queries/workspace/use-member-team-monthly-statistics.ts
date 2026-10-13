import { useQuery } from "@tanstack/react-query";
import getMemberTeamMonthlyStatistics from "@/fetchers/workspace/get-member-team-monthly-statistics";

function useMemberTeamMonthlyStatistics(
  workspaceId: string,
  projectId?: string,
  startDate?: string,
  endDate?: string,
  milestoneId?: string,
) {
  return useQuery({
    queryKey: [
      "member-team-monthly-statistics",
      workspaceId,
      projectId,
      startDate,
      endDate,
      milestoneId,
    ],
    queryFn: () =>
      getMemberTeamMonthlyStatistics(
        workspaceId,
        projectId,
        startDate,
        endDate,
        milestoneId,
      ),
    enabled: Boolean(workspaceId),
  });
}

export default useMemberTeamMonthlyStatistics;
