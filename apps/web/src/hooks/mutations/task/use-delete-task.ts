import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteTask from "@/fetchers/task/delete-task";
import { invalidateMilestoneTasks } from "@/lib/milestone-cache";

export function useDeleteTask() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteTask,
    onSuccess: (task) => invalidateMilestoneTasks(client, task.projectId),
  });
}
