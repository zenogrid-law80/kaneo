import { useQuery } from "@tanstack/react-query";
import { getBugComments } from "@/fetchers/bug/comments";
import { isUnauthorizedError } from "@/lib/http-error";

export function useBugComments(projectId: string, bugId: string, page: number) {
  return useQuery({
    queryKey: ["bug-comments", projectId, bugId, page],
    queryFn: () => getBugComments(projectId, bugId, page),
    enabled: !!projectId && !!bugId,
    retry: false,
    refetchInterval: (query) =>
      isUnauthorizedError(query.state.error) ? false : 30000,
  });
}
