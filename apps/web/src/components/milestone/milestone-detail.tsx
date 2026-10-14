import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Flag, Link, Plus } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { useTranslation } from "react-i18next";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getMilestoneCandidates } from "@/fetchers/milestone";
import {
  useMilestoneMutations,
  useSetTaskMilestone,
} from "@/hooks/mutations/milestone/use-milestone-mutations";
import useCreateTask from "@/hooks/mutations/task/use-create-task";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import {
  useMilestone,
  useMilestoneTasks,
} from "@/hooks/queries/milestone/use-milestones";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import MilestoneForm from "./milestone-form";

function LinkTasks({
  projectId,
  milestoneId,
  onClose,
}: {
  projectId: string;
  milestoneId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["milestone-candidates", projectId, deferredSearch, page],
    queryFn: () => getMilestoneCandidates(projectId, deferredSearch, page),
  });
  const mutation = useSetTaskMilestone(projectId);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("tasks:milestones.linkTask")}</DialogTitle>
          <DialogDescription>
            {t("tasks:milestones.linkDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-3">
          <Input
            aria-label={t("tasks:milestones.searchTasks")}
            placeholder={t("tasks:milestones.searchTasks")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          {query.isLoading && <p role="status">{t("common:empty.loading")}</p>}
          {query.isError && (
            <p role="alert">{t("tasks:milestones.loadError")}</p>
          )}
          {query.data?.data.length === 0 && (
            <p>{t("tasks:milestones.noMatchingTasks")}</p>
          )}
          {query.data?.data.map((task) => (
            <Button
              key={task.id}
              variant="ghost"
              className="h-auto w-full justify-start whitespace-normal text-left"
              disabled={mutation.isPending}
              onClick={async () => {
                try {
                  await mutation.mutateAsync({ taskId: task.id, milestoneId });
                  await query.refetch();
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : t("tasks:milestones.saveError"),
                  );
                }
              }}
            >
              #{task.number} {task.title}
            </Button>
          ))}
          {query.data && query.data.pagination.totalPages > 1 && (
            <div className="flex justify-between">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                {t("tasks:milestones.previous")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= query.data.pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                {t("tasks:milestones.next")}
              </Button>
            </div>
          )}
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
export default function MilestoneDetail({
  id,
  projectId,
  workspaceId,
  onBack,
}: {
  id: string;
  projectId: string;
  workspaceId: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const query = useMilestone(projectId, id);
  const [page, setPage] = useState(1);
  const [archived, setArchived] = useState(false);
  const tasks = useMilestoneTasks(projectId, id, page, archived);
  const mutations = useMilestoneMutations(projectId);
  const assign = useSetTaskMilestone(projectId);
  const createTask = useCreateTask();
  const { data: columns = [] } = useGetColumns(projectId);
  const { canUpdateProjects, canUpdateTasks, canCreateTasks } =
    useWorkspacePermission();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [linking, setLinking] = useState(false);
  const [title, setTitle] = useState("");
  const [taskId, setTaskId] = useState<string>();
  const milestone = query.data;
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:milestones.saveError"),
      );
    }
  };
  if (query.isLoading) return <p role="status">{t("common:empty.loading")}</p>;
  if (query.isError || !milestone || milestone.projectId !== projectId)
    return (
      <div className="space-y-3">
        <p role="alert">{t("tasks:milestones.notFound")}</p>
        <Button onClick={onBack}>{t("tasks:milestones.back")}</Button>
        {query.isError && (
          <Button variant="outline" onClick={() => void query.refetch()}>
            {t("tasks:milestones.retry")}
          </Button>
        )}
      </div>
    );
  const pending = mutations.update.isPending || mutations.remove.isPending;
  const targetStatus =
    columns.find((column) => !column.isFinal)?.slug ?? columns[0]?.slug;
  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="size-4" />
        {t("tasks:milestones.back")}
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Flag className="size-5" />
            {milestone.name}
            {milestone.isCurrent && (
              <Badge variant="secondary">{t("tasks:milestones.current")}</Badge>
            )}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {milestone.status === "open"
              ? t("tasks:milestones.open")
              : t("tasks:milestones.closed")}{" "}
            · {milestone.dueDate ?? t("tasks:milestones.noDate")}
          </p>
        </div>
        {canUpdateProjects() && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setEditing(true)}
            >
              {t("tasks:milestones.edit")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                void run(() =>
                  mutations.update.mutateAsync({
                    id,
                    input: {
                      status: milestone.status === "open" ? "closed" : "open",
                    },
                  }),
                )
              }
            >
              {milestone.status === "open"
                ? t("tasks:milestones.close")
                : t("tasks:milestones.reopen")}
            </Button>
            {canUpdateTasks() && (
              <Button
                size="sm"
                variant="destructive"
                disabled={pending}
                onClick={() => setDeleting(true)}
              >
                {t("tasks:milestones.delete")}
              </Button>
            )}
          </div>
        )}
      </div>
      {milestone.description && (
        <p className="whitespace-pre-wrap text-sm">{milestone.description}</p>
      )}
      <div className="space-y-2 rounded-lg border p-4">
        <p className="text-sm font-medium">
          {t("tasks:milestones.progress", {
            completed: milestone.completedTasks,
            total: milestone.totalTasks,
          })}{" "}
          · {milestone.progressPercent}%
        </p>
        <progress
          value={milestone.progressPercent}
          max={100}
          className="h-2 w-full accent-primary"
          aria-label={t("tasks:milestones.progressLabel")}
        />
        <p className="text-xs text-muted-foreground">
          {t("tasks:milestones.archivedExcluded", {
            total: milestone.archivedTasks,
          })}
        </p>
        {milestone.status === "open" &&
          milestone.totalTasks > milestone.completedTasks && (
            <p className="text-xs text-muted-foreground">
              {t("tasks:milestones.remaining", {
                total: milestone.totalTasks - milestone.completedTasks,
              })}
            </p>
          )}
      </div>
      <div className="flex flex-wrap justify-between gap-2">
        <h2 className="font-medium">{t("tasks:milestones.tasks")}</h2>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={archived}
            onClick={() => {
              setArchived(!archived);
              setPage(1);
            }}
          >
            {archived
              ? t("tasks:milestones.activeTasks")
              : t("tasks:milestones.archivedTasks")}
          </Button>
          {canUpdateTasks() && milestone.status === "open" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLinking(true)}
            >
              <Link className="size-4" />
              {t("tasks:milestones.linkTask")}
            </Button>
          )}
        </div>
      </div>
      {canCreateTasks() && milestone.status === "open" && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim() || !targetStatus) return;
            void run(async () => {
              await createTask.mutateAsync({
                projectId,
                milestoneId: id,
                title: title.trim(),
                description: "",
                status: targetStatus,
                priority: "no-priority",
              });
              setTitle("");
            });
          }}
        >
          <Input
            aria-label={t("tasks:milestones.newTask")}
            placeholder={t("tasks:milestones.newTask")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={createTask.isPending}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!title.trim() || !targetStatus || createTask.isPending}
          >
            <Plus className="size-4" />
            {t("tasks:milestones.addTask")}
          </Button>
        </form>
      )}
      {tasks.isLoading && <p role="status">{t("common:empty.loading")}</p>}
      {tasks.isError && (
        <div role="alert">
          <p>{t("tasks:milestones.loadError")}</p>
          <Button onClick={() => void tasks.refetch()}>
            {t("tasks:milestones.retry")}
          </Button>
        </div>
      )}
      {tasks.data?.data.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t("tasks:milestones.noTasks")}
        </p>
      )}
      <div className="divide-y rounded-lg border">
        {tasks.data?.data.map((task) => (
          <div key={task.id} className="flex items-center gap-2 p-3">
            <button
              type="button"
              className="flex-1 text-left text-sm hover:underline"
              onClick={() => setTaskId(task.id)}
            >
              <span className="mr-2 text-xs text-muted-foreground">
                #{task.number}
              </span>
              {task.title}
            </button>
            {canUpdateTasks() && (
              <Button
                size="xs"
                variant="ghost"
                disabled={assign.isPending}
                onClick={() =>
                  void run(() =>
                    assign.mutateAsync({ taskId: task.id, milestoneId: null }),
                  )
                }
              >
                {t("tasks:milestones.unlink")}
              </Button>
            )}
          </div>
        ))}
      </div>
      {tasks.data && tasks.data.pagination.totalPages > 1 && (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            {t("tasks:milestones.previous")}
          </Button>
          <span>
            {page} / {tasks.data.pagination.totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= tasks.data.pagination.totalPages}
            onClick={() => setPage(page + 1)}
          >
            {t("tasks:milestones.next")}
          </Button>
        </div>
      )}
      {editing && (
        <MilestoneForm
          milestone={milestone}
          onClose={() => setEditing(false)}
          onSave={(input) => mutations.update.mutateAsync({ id, input })}
        />
      )}
      {linking && (
        <LinkTasks
          projectId={projectId}
          milestoneId={id}
          onClose={() => setLinking(false)}
        />
      )}
      <AlertDialog
        open={deleting}
        onOpenChange={(open) => {
          if (!mutations.remove.isPending) setDeleting(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("tasks:milestones.delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("tasks:milestones.deleteDescription", {
                total: milestone.totalTasks + milestone.archivedTasks,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              disabled={mutations.remove.isPending}
              onClick={() => setDeleting(false)}
            >
              {t("common:actions.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={mutations.remove.isPending}
              onClick={() =>
                void run(async () => {
                  await mutations.remove.mutateAsync(id);
                  onBack();
                })
              }
            >
              {t("tasks:milestones.delete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <TaskDetailsSheet
        taskId={taskId}
        projectId={projectId}
        workspaceId={workspaceId}
        onClose={() => setTaskId(undefined)}
      />
    </div>
  );
}
