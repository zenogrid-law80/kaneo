import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createBugComment,
  deleteBugComment,
  updateBugComment,
} from "@/fetchers/bug/comments";

export function useBugCommentMutations(projectId: string, bugId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["bug-comments", projectId, bugId],
      }),
      queryClient.invalidateQueries({ queryKey: ["workspace-activity"] }),
    ]);
  const create = useMutation({
    mutationFn: (content: string) =>
      createBugComment(projectId, bugId, content),
    onSuccess,
  });
  const update = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      updateBugComment(projectId, bugId, id, content),
    onSuccess,
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteBugComment(projectId, bugId, id),
    onSuccess,
  });
  return { create, update, remove };
}
