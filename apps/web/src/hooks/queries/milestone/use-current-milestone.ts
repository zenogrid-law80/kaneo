import { useQuery } from "@tanstack/react-query";
import { getCurrentMilestone } from "@/fetchers/milestone";
import { isUnauthorizedError } from "@/lib/http-error";

export function useCurrentMilestone(projectId: string, enabled = true) {
  return useQuery({
    queryKey: ["milestones", projectId, "current"],
    queryFn: () => getCurrentMilestone(projectId),
    enabled: !!projectId && enabled,
    refetchInterval: (query) =>
      isUnauthorizedError(query.state.error) ? false : 30_000,
  });
}
