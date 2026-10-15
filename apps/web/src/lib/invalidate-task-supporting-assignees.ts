import type { QueryClient } from "@tanstack/react-query";
import { prepareSupportingAssigneesRefresh } from "./refresh-board-supporting-assignees";

export async function invalidateTaskSupportingAssignees(
  client: QueryClient,
  projectId: string,
  taskId?: string,
) {
  const refreshBoard = prepareSupportingAssigneesRefresh(
    client,
    projectId,
    taskId,
  );
  await Promise.all([
    client.invalidateQueries({
      queryKey: taskId ? ["activities", taskId] : ["activities"],
    }),
    client.invalidateQueries({ queryKey: ["workspace-activity"] }),
    client.invalidateQueries({
      queryKey: taskId
        ? ["task-supporting-assignees", projectId, taskId]
        : ["task-supporting-assignees", projectId],
    }),
    client.invalidateQueries({
      predicate: (query) =>
        (query.queryKey[0] === "workspace-member-statistics" ||
          query.queryKey[0] === "member-team-monthly-statistics") &&
        (!query.queryKey[2] || query.queryKey[2] === projectId) &&
        query.queryKey[6] === true,
    }),
  ]);
  await refreshBoard?.();
}
