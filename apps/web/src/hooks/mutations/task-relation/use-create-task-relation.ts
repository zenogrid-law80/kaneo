import { useMutation, useQueryClient } from "@tanstack/react-query";
import createTaskRelation from "@/fetchers/task-relation/create-task-relation";

import { invalidateRelationTaskProject } from "./invalidate-relation-task-project";

function useCreateTaskRelation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTaskRelation,
    onSuccess: (_, variables) =>
      Promise.all([
        invalidateRelationTaskProject(queryClient, variables.sourceTaskId),
        queryClient.invalidateQueries({
          queryKey: ["task", variables.sourceTaskId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["task-relations", variables.sourceTaskId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["task-relations", variables.targetTaskId],
        }),
      ]),
  });
}

export default useCreateTaskRelation;
