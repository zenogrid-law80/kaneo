import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  getMilestone,
  getMilestones,
  getMilestoneTasks,
  type MilestoneListQuery,
} from "@/fetchers/milestone";
import { isUnauthorizedError } from "@/lib/http-error";

const refetchInterval = (query: { state: { error: unknown } }) =>
  isUnauthorizedError(query.state.error) ? (false as const) : 30_000;
export function useMilestones(
  projectId: string,
  filters: MilestoneListQuery = {},
) {
  return useQuery({
    queryKey: ["milestones", projectId, filters],
    queryFn: () => getMilestones(projectId, filters),
    enabled: !!projectId,
    refetchInterval,
  });
}
// Selectors must include every open milestone, not only the first page.
export function useMilestoneOptions(projectId: string) {
  return useInfiniteQuery({
    queryKey: ["milestones", projectId, "options"],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      getMilestones(projectId, { page: String(pageParam), limit: "100" }),
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages
        ? last.pagination.page + 1
        : undefined,
    enabled: !!projectId,
    refetchInterval,
  });
}
export function useMilestone(projectId: string, id?: string) {
  return useQuery({
    queryKey: ["milestone", projectId, id],
    queryFn: () => getMilestone(id!),
    enabled: !!id,
    retry: false,
    refetchInterval,
  });
}
export function useMilestoneTasks(
  projectId: string,
  id?: string,
  page = 1,
  archived = false,
) {
  return useQuery({
    queryKey: ["milestone-tasks", projectId, id, { page, archived }],
    queryFn: () => getMilestoneTasks(id!, page, archived),
    enabled: !!id,
    refetchInterval,
  });
}
