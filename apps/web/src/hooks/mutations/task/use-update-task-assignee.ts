import { invalidateTaskSupportingAssignees } from "@/lib/invalidate-task-supporting-assignees";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateMyWork } from "@/lib/invalidate-my-work";
import updateTaskAssignee from "@/fetchers/task/update-task-assignee";
import type Task from "@/types/task";

export function useUpdateTaskAssignee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (task: Task) => updateTaskAssignee(task.id, task),
    onSuccess: (_, variables) => {
      invalidateMyWork(queryClient);
      void invalidateTaskSupportingAssignees(
        queryClient,
        variables.projectId,
        variables.id,
      );
      queryClient.invalidateQueries({
        queryKey: ["task", variables.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["tasks", variables.projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["notifications"],
      });
      queryClient.invalidateQueries({
        queryKey: ["projects"],
      });
      queryClient.invalidateQueries({
        queryKey: ["activities", variables.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["task-relations"],
      });
    },
  });
}
