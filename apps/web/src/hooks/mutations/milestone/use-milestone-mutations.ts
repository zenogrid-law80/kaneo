import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createMilestone,
  deleteMilestone,
  type MilestoneInput,
  type MilestoneUpdate,
  updateMilestone,
  updateTaskMilestone,
} from "@/fetchers/milestone";
import {
  invalidateMilestones,
  invalidateMilestoneTasks,
} from "@/lib/milestone-cache";

export function useMilestoneMutations(projectId: string) {
  const client = useQueryClient();
  return {
    create: useMutation({
      mutationFn: (input: MilestoneInput) => createMilestone(projectId, input),
      onSuccess: () => invalidateMilestones(client, projectId),
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: MilestoneUpdate }) =>
        updateMilestone(id, input),
      onSuccess: () => invalidateMilestones(client, projectId),
    }),
    remove: useMutation({
      mutationFn: deleteMilestone,
      onSuccess: (_, id) => {
        client.removeQueries({ queryKey: ["milestone", projectId, id] });
        client.removeQueries({ queryKey: ["milestone-tasks", projectId, id] });
        invalidateMilestoneTasks(client, projectId);
      },
    }),
  };
}
export function useSetTaskMilestone(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      milestoneId,
    }: {
      taskId: string;
      milestoneId: string | null;
    }) => updateTaskMilestone(taskId, milestoneId),
    onSuccess: () => invalidateMilestoneTasks(client, projectId),
  });
}
