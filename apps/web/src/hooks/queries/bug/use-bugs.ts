import { useQuery } from "@tanstack/react-query";
import {
  getBug,
  getBugHistory,
  getBugs,
  getBugTemplate,
  type BugStatus,
  type BugFilters,
} from "@/fetchers/bug";
import { isUnauthorizedError } from "@/lib/http-error";

const refetchInterval = (query: { state: { error: unknown } }) =>
  isUnauthorizedError(query.state.error) ? (false as const) : 30_000;
export function useBugs(
  projectId: string,
  status: BugStatus | undefined,
  page: number,
  filters: BugFilters = {},
) {
  return useQuery({
    queryKey: ["bugs", projectId, "list", status, page, filters],
    queryFn: () => getBugs(projectId, status, page, filters),
    enabled: !!projectId,
    refetchInterval,
  });
}
export function useBug(projectId: string, id: string) {
  return useQuery({
    queryKey: ["bugs", projectId, "detail", id],
    queryFn: () => getBug(projectId, id),
    enabled: !!projectId && !!id,
    retry: false,
    refetchInterval,
  });
}
export function useBugTemplate(projectId: string) {
  return useQuery({
    queryKey: ["bug-template", projectId],
    queryFn: () => getBugTemplate(projectId),
    enabled: !!projectId,
    refetchInterval,
  });
}

export function useBugHistory(projectId: string, id: string, page: number) {
  return useQuery({
    queryKey: ["bugs", projectId, "history", id, page],
    queryFn: () => getBugHistory(projectId, id, page),
    enabled: !!projectId && !!id,
    retry: false,
    refetchInterval,
  });
}
