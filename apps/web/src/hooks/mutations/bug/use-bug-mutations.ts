import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createBug,
  updateBug,
  deleteBug,
  updateBugTemplate,
  type BugInput,
  type BugUpdate,
} from "@/fetchers/bug";

export function useBugMutations(projectId: string) {
  const client = useQueryClient();
  const invalidate = () =>
    client.invalidateQueries({ queryKey: ["bugs", projectId] });
  return {
    create: useMutation({
      mutationFn: (input: BugInput) => createBug(projectId, input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: BugUpdate }) =>
        updateBug(projectId, id, input),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteBug(projectId, id),
      onSuccess: (_, id) => {
        client.removeQueries({ queryKey: ["bugs", projectId, "detail", id] });
        return invalidate();
      },
    }),
  };
}
export function useUpdateBugTemplate(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (template: string | null) =>
      updateBugTemplate(projectId, template),
    onSuccess: (data) => {
      client.setQueryData(["bug-template", projectId], data);
      return client.invalidateQueries({
        queryKey: ["bug-template", projectId],
      });
    },
  });
}
