import { Link2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import useCreateTaskRelation from "@/hooks/mutations/task-relation/use-create-task-relation";
import useGetTaskRelations from "@/hooks/queries/task-relation/use-get-task-relations";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { HttpError } from "@/lib/http-error";
import { toast } from "@/lib/toast";
import TaskRelationPicker from "./task-relation-picker";

type TaskSubtaskLinkerProps = {
  taskId: string;
  workspaceId: string;
  onLinked: () => void;
};

export default function TaskSubtaskLinker({
  taskId,
  workspaceId,
  onLinked,
}: TaskSubtaskLinkerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const {
    data: relations = [],
    isLoading,
    isError,
  } = useGetTaskRelations(taskId);
  const createRelation = useCreateTaskRelation();
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();
  const excludedTaskIds = [
    taskId,
    ...relations
      .filter((relation) => relation.relationType === "subtask")
      .flatMap((relation) => [relation.sourceTaskId, relation.targetTaskId]),
  ];

  async function linkSubtask(childId: string) {
    if (
      !canEdit ||
      createRelation.isPending ||
      excludedTaskIds.includes(childId)
    )
      return;
    try {
      await createRelation.mutateAsync({
        sourceTaskId: taskId,
        targetTaskId: childId,
        relationType: "subtask",
      });
      setOpen(false);
      onLinked();
      toast.success(t("tasks:subtasks.linkSuccess"));
    } catch (error) {
      toast.error(
        t(
          error instanceof HttpError && error.status === 400
            ? "tasks:subtasks.invalidHierarchy"
            : "tasks:subtasks.linkError",
        ),
      );
    }
  }

  if (!canEdit) return null;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="text-muted-foreground"
        disabled={isLoading || isError || createRelation.isPending}
        onClick={() => setOpen(true)}
      >
        <Link2 className="size-3.5" />
        {t("tasks:subtasks.linkExisting")}
      </Button>
      {open && (
        <TaskRelationPicker
          title={t("tasks:subtasks.linkExisting")}
          searchHint={t("tasks:subtasks.linkHint")}
          emptyMessage={t("tasks:subtasks.noTasksToLink")}
          workspaceId={workspaceId}
          excludedTaskIds={excludedTaskIds}
          isPending={createRelation.isPending}
          onSelect={linkSubtask}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
