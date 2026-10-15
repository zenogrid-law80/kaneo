import { useMutation, useQueryClient } from "@tanstack/react-query";
import setTaskSupportingAssignee from "@/fetchers/task/set-task-supporting-assignee";
import { invalidateTaskSupportingAssignees } from "@/lib/invalidate-task-supporting-assignees";

export default function useSetTaskSupportingAssignee(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setTaskSupportingAssignee,
    onSuccess: async (_, { taskId }) => {
      await invalidateTaskSupportingAssignees(queryClient, projectId, taskId);
    },
  });
}
