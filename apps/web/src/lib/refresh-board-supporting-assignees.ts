import type { QueryClient } from "@tanstack/react-query";
import getTaskSupportingAssignees from "@/fetchers/task/get-task-supporting-assignees";
import type { ProjectWithTasks } from "@/types/project";
import {
  getBoardCacheVersion,
  markBoardCacheChanged,
} from "./board-cache-version";
import { updateBoardTaskCache } from "./update-board-task-cache";

export function prepareSupportingAssigneesRefresh(
  client: QueryClient,
  projectId: string,
  taskId?: string,
) {
  if (!taskId) return;
  const board = client.getQueryData<ProjectWithTasks>(["tasks", projectId]);
  const exists =
    board &&
    [
      ...board.columns.flatMap((column) => column.tasks),
      ...board.plannedTasks,
      ...board.archivedTasks,
    ].some((task) => task.id === taskId);
  if (!board) return;
  // A task-created refresh may still be in flight before the card exists.
  // Invalidate its version so an older snapshot cannot hide this assignment.
  markBoardCacheChanged(client, projectId, taskId);
  if (!exists) return;
  const version = getBoardCacheVersion(client, projectId, taskId);
  return async () => {
    try {
      // Reuse a detail query refreshed by invalidation; inactive rows fetch
      // only this task's supporting members instead of the whole board.
      const supportingAssignees = await client.fetchQuery({
        queryKey: ["task-supporting-assignees", projectId, taskId],
        queryFn: () => getTaskSupportingAssignees(taskId),
        staleTime: Infinity,
      });
      updateBoardTaskCache(
        client,
        projectId,
        taskId,
        { supportingAssignees },
        version,
      );
    } catch {
      await client.invalidateQueries({ queryKey: ["tasks", projectId] });
    }
  };
}
