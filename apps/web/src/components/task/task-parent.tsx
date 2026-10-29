import { useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Plus, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import useCreateTaskRelation from "@/hooks/mutations/task-relation/use-create-task-relation";
import useDeleteTaskRelation from "@/hooks/mutations/task-relation/use-delete-task-relation";
import useGetTaskRelations from "@/hooks/queries/task-relation/use-get-task-relations";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { HttpError } from "@/lib/http-error";
import { toast } from "@/lib/toast";
import TaskRelationPicker from "./task-relation-picker";

type TaskParentProps = {
  taskId: string;
  workspaceId: string;
};

export default function TaskParent({ taskId, workspaceId }: TaskParentProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);
  const {
    data: relations = [],
    isLoading,
    isError,
    refetch,
  } = useGetTaskRelations(taskId);
  const createRelation = useCreateTaskRelation();
  const deleteRelation = useDeleteTaskRelation(taskId);
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();
  const isPending = createRelation.isPending || deleteRelation.isPending;
  const parents = relations.filter(
    (relation) =>
      relation.relationType === "subtask" && relation.targetTaskId === taskId,
  );
  const excludedTaskIds = [
    taskId,
    ...relations
      .filter((relation) => relation.relationType === "subtask")
      .flatMap((relation) => [relation.sourceTaskId, relation.targetTaskId]),
  ];

  async function assignParent(parentId: string) {
    if (!canEdit || isPending) return;
    try {
      await createRelation.mutateAsync({
        sourceTaskId: parentId,
        targetTaskId: taskId,
        relationType: "subtask",
      });
      setPickerOpen(false);
      toast.success(t("tasks:parent.assignSuccess"));
    } catch (error) {
      toast.error(
        t(
          error instanceof HttpError && error.status === 400
            ? "tasks:parent.invalidHierarchy"
            : "tasks:parent.assignError",
        ),
      );
    }
  }

  async function removeParent(relationId: string) {
    if (!canEdit || isPending) return;
    try {
      await deleteRelation.mutateAsync(relationId);
      toast.success(t("tasks:parent.removeSuccess"));
    } catch {
      toast.error(t("tasks:parent.removeError"));
    }
  }

  if (isLoading)
    return (
      <p className="text-xs text-muted-foreground">
        {t("tasks:parent.loading")}
      </p>
    );
  if (isError)
    return (
      <div className="flex items-center gap-2 text-xs">
        <span role="alert">{t("tasks:parent.loadError")}</span>
        <Button variant="ghost" size="xs" onClick={() => void refetch()}>
          {t("tasks:parent.retry")}
        </Button>
      </div>
    );

  if (!canEdit && parents.length === 0) return null;

  return (
    <div className="flex flex-col items-start gap-1">
      {parents.map((relation) => {
        const parent = relation.sourceTask;
        if (!parent) return null;
        return (
          <div key={relation.id} className="flex max-w-full items-center gap-1">
            <button
              type="button"
              className="flex min-w-0 items-center gap-1 rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              onClick={() =>
                void navigate({
                  to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
                  params: {
                    workspaceId,
                    projectId: parent.projectId,
                    taskId: relation.sourceTaskId,
                  },
                })
              }
            >
              <ArrowUpRight className="size-3 shrink-0" />
              <span className="truncate">
                {t("tasks:detail.subtaskOf")}{" "}
                <span className="font-medium">{parent.title}</span>
              </span>
            </button>
            {canEdit && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={t("tasks:parent.remove", {
                  title: parent.title,
                })}
                disabled={isPending}
                onClick={() => void removeParent(relation.id)}
              >
                <X className="size-3" />
              </Button>
            )}
          </div>
        );
      })}
      {canEdit && parents.length === 0 && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="text-muted-foreground"
          disabled={isPending}
          onClick={() => setPickerOpen(true)}
        >
          <Plus className="size-3" />
          {t("tasks:parent.assign")}
        </Button>
      )}
      {pickerOpen && canEdit && (
        <TaskRelationPicker
          title={t("tasks:parent.assign")}
          searchHint={t("tasks:parent.searchHint")}
          emptyMessage={t("tasks:parent.noResults")}
          workspaceId={workspaceId}
          excludedTaskIds={excludedTaskIds}
          isPending={isPending}
          onSelect={assignParent}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
