import { useQuery } from "@tanstack/react-query";
import getTaskSupportingAssignees from "@/fetchers/task/get-task-supporting-assignees";

export default function useTaskSupportingAssignees(
  taskId: string,
  projectId: string,
) {
  return useQuery({
    queryKey: ["task-supporting-assignees", projectId, taskId],
    queryFn: () => getTaskSupportingAssignees(taskId),
    enabled: Boolean(taskId && projectId),
  });
}
