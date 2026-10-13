import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteColumn from "@/fetchers/column/delete-column";
import { invalidateMilestones } from "@/lib/milestone-cache";

export function useDeleteColumn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) => deleteColumn(id),
    onSuccess: async () => {
      await invalidateMilestones(queryClient);
      await queryClient.invalidateQueries({ refetchType: "all" });
    },
  });
}
