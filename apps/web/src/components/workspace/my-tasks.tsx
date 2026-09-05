import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { MyTasksDueFilter } from "@/fetchers/task/get-my-tasks";
import useGetMyTasks from "@/hooks/queries/task/use-get-my-tasks";
import { useProjectWebSocket } from "@/hooks/use-project-websocket";
import { formatDateShort } from "@/lib/format";
import { getPriorityLabel } from "@/lib/i18n/domain";
import { getMyTaskDueGroup } from "@/lib/my-task-due-group";

export default function MyTasks({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const [due, setDue] = useState<MyTasksDueFilter>("all");
  const selectDue = (value: MyTasksDueFilter) => {
    setDue(value);
    setPage(1);
  };
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<{ id: string; projectId: string }>();
  const { data, isPending, isError, refetch } = useGetMyTasks(
    workspaceId,
    page,
    due,
  );
  useProjectWebSocket(selected?.projectId ?? "");
  const labels = {
    all: t("workspace:myTasks.all"),
    overdue: t("workspace:myTasks.overdue"),
    today: t("workspace:myTasks.today"),
    upcoming: t("workspace:myTasks.upcoming"),
    undated: t("workspace:myTasks.undated"),
  };
  return (
    <section
      className="mb-8 rounded-xl border border-border bg-card"
      aria-label={t("workspace:myTasks.title")}
    >
      <div className="border-b border-border px-4 py-4">
        <h2 className="text-sm font-semibold">
          {t("workspace:myTasks.title")}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("workspace:myTasks.description")}
        </p>
      </div>
      <fieldset
        className="flex min-w-0 flex-wrap items-center gap-2 border-b border-border px-4 py-3"
        aria-label={t("common:actions.filter")}
      >
        {(["all", "overdue", "today", "undated"] as const).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={due === value ? "secondary" : "ghost"}
            aria-pressed={due === value}
            onClick={() => selectDue(value)}
          >
            {labels[value]}
          </Button>
        ))}
      </fieldset>
      {due !== "all" && (
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => selectDue("all")}
            aria-label={t("workspace:myTasks.removeFilter", {
              name: labels[due],
            })}
          >
            {labels[due]}
            <X className="size-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => selectDue("all")}>
            {t("common:actions.clearAllFilters")}
          </Button>
        </div>
      )}
      {isError ? (
        <div className="p-4" role="alert">
          <p className="mb-2 text-sm text-muted-foreground">
            {t("workspace:myTasks.error")}
          </p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            {t("workspace:myTasks.retry")}
          </Button>
        </div>
      ) : isPending ? (
        <div
          role="status"
          className="space-y-3 p-4"
          aria-label={t("common:empty.loading")}
        >
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : !data?.items.length ? (
        <p className="p-6 text-sm text-muted-foreground">
          {due === "all"
            ? t("workspace:myTasks.empty")
            : t("workspace:myTasks.noResults")}
        </p>
      ) : (
        <div className="divide-y divide-border/60">
          {data.items.map((task) => {
            const group = getMyTaskDueGroup(task.dueDate);
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => setSelected(task)}
                className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {task.title}
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {task.projectName} · {task.projectSlug}-{task.number} ·{" "}
                    {getPriorityLabel(task.priority ?? "no-priority")}
                  </span>
                </span>
                <span
                  className={`shrink-0 text-right text-xs ${group === "overdue" ? "text-destructive-foreground" : "text-muted-foreground"}`}
                >
                  <span className="block">{labels[group]}</span>
                  {task.dueDate && (
                    <span className="mt-1 block">
                      {formatDateShort(task.dueDate)}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {(page > 1 || data?.hasMore) && (
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1 || isPending}
            onClick={() => setPage(page - 1)}
          >
            {t("workspace:myTasks.previous")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!data?.hasMore || isPending || isError}
            onClick={() => setPage(page + 1)}
          >
            {t("workspace:myTasks.next")}
          </Button>
        </div>
      )}
      {selected && (
        <TaskDetailsSheet
          taskId={selected.id}
          projectId={selected.projectId}
          workspaceId={workspaceId}
          onClose={() => setSelected(undefined)}
        />
      )}
    </section>
  );
}
