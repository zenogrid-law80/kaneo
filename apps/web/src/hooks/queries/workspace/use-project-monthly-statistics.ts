import { useQuery } from "@tanstack/react-query";
import getProjectMonthlyStatistics from "@/fetchers/workspace/get-project-monthly-statistics";

function useProjectMonthlyStatistics(
  workspaceId: string,
  projectId?: string,
  startDate?: string,
  endDate?: string,
) {
  return useQuery({
    queryKey: [
      "project-monthly-statistics",
      workspaceId,
      projectId,
      startDate,
      endDate,
    ],
    queryFn: () =>
      getProjectMonthlyStatistics(workspaceId, projectId, startDate, endDate),
    enabled: Boolean(workspaceId),
  });
}

export default useProjectMonthlyStatistics;
