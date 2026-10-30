import type { QueryClient } from "@tanstack/react-query";

export function invalidateMilestones(client: QueryClient, projectId?: string) {
  for (const key of ["milestones", "milestone", "milestone-tasks"]) {
    void client.invalidateQueries({
      queryKey: projectId ? [key, projectId] : [key],
    });
  }
  void client.invalidateQueries({
    predicate: (query) =>
      (query.queryKey[0] === "workspace-member-statistics" ||
        query.queryKey[0] === "member-team-monthly-statistics") &&
      (!projectId || query.queryKey[2] === projectId),
  });
}
export function invalidateMilestoneTasks(
  client: QueryClient,
  projectId: string,
) {
  invalidateMilestones(client, projectId);
  for (const key of [
    ["bugs", projectId],
    ["tasks", projectId],
    ["task"],
    ["my-tasks"],
    ["activities"],
    ["milestone-candidates", projectId],
  ])
    void client.invalidateQueries({ queryKey: key });
}
