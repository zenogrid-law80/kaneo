import { useMutation, useQueryClient } from "@tanstack/react-query";
import clearTaskSupportingAssignees from "@/fetchers/task/clear-task-supporting-assignees";
import { invalidateTaskSupportingAssignees } from "@/lib/invalidate-task-supporting-assignees";

export default function useClearTaskSupportingAssignees(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clearTaskSupportingAssignees,
    onSuccess: async (_, { taskId }) => {
      await invalidateTaskSupportingAssignees(queryClient, projectId, taskId);
    },
  });
}
