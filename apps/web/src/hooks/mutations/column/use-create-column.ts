import { useMutation, useQueryClient } from "@tanstack/react-query";
import createColumn from "@/fetchers/column/create-column";
import { invalidateMilestones } from "@/lib/milestone-cache";

export function useCreateColumn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: { name: string; icon?: string; color?: string; isFinal?: boolean };
    }) => createColumn(projectId, data),
    onSuccess: async () => {
      await invalidateMilestones(queryClient);
      await queryClient.invalidateQueries({ refetchType: "all" });
    },
  });
}
