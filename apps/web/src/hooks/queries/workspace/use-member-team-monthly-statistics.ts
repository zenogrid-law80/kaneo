import { useQuery } from "@tanstack/react-query";
import getMemberTeamMonthlyStatistics from "@/fetchers/workspace/get-member-team-monthly-statistics";

function useMemberTeamMonthlyStatistics(
  workspaceId: string,
  projectId?: string,
  startDate?: string,
  endDate?: string,
) {
  return useQuery({
    queryKey: [
      "member-team-monthly-statistics",
      workspaceId,
      projectId,
      startDate,
      endDate,
    ],
    queryFn: () =>
      getMemberTeamMonthlyStatistics(
        workspaceId,
        projectId,
        startDate,
        endDate,
      ),
    enabled: Boolean(workspaceId),
  });
}

export default useMemberTeamMonthlyStatistics;
