import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateColumn from "@/fetchers/column/update-column";
import { invalidateMilestones } from "@/lib/milestone-cache";

export function useUpdateColumn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      projectId: string;
      data: {
        name?: string;
        icon?: string | null;
        color?: string | null;
        isFinal?: boolean;
      };
    }) => updateColumn(id, data),
    onSuccess: async (_, variables) => {
      invalidateMilestones(queryClient);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["columns", variables.projectId],
          refetchType: "all",
        }),
        queryClient.invalidateQueries({
          queryKey: ["tasks", variables.projectId],
          refetchType: "all",
        }),
      ]);
    },
  });
}
