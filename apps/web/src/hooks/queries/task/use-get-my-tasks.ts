import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import getMyTasks, {
  type MyTasksDueFilter,
} from "@/fetchers/task/get-my-tasks";
import { authClient } from "@/lib/auth-client";
import { isUnauthorizedError } from "@/lib/http-error";

export default function useGetMyTasks(
  workspaceId: string,
  page: number,
  due: MyTasksDueFilter = "all",
) {
  const { data: session } = authClient.useSession();
  const queryClient = useQueryClient();
  const now = new Date();
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).toISOString();
  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  ).toISOString();
  useEffect(
    () =>
      queryClient.getMutationCache().subscribe((event) => {
        // Detail editors use different mutation keys; refresh the summary after any
        // successful edit while it is mounted, including assign/unassign and move.
        if (event.type === "updated" && event.action.type === "success") {
          void queryClient.invalidateQueries({
            queryKey: ["my-tasks", workspaceId],
          });
        }
      }),
    [queryClient, workspaceId],
  );
  return useQuery({
    queryKey: [
      "my-tasks",
      workspaceId,
      session?.user.id,
      page,
      due,
      start,
      end,
    ],
    queryFn: () => getMyTasks(workspaceId, page, due, start, end),
    enabled: !!workspaceId && !!session?.user.id,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // The home spans projects; avoid opening one socket per project.
    refetchInterval: (query) =>
      isUnauthorizedError(query.state.error) ? false : 30_000,
  });
}
