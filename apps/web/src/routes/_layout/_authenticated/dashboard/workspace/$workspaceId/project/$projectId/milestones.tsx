import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Flag, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import MilestoneDetail from "@/components/milestone/milestone-detail";
import MilestoneForm from "@/components/milestone/milestone-form";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { useMilestoneMutations } from "@/hooks/mutations/milestone/use-milestone-mutations";
import { useMilestones } from "@/hooks/queries/milestone/use-milestones";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { isMilestoneOverdue, localDateString } from "@/lib/milestone-date";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/milestones",
)({
  component: MilestonesPage,
  validateSearch: (
    search: Record<string, unknown>,
  ): { milestoneId?: string } => ({
    milestoneId:
      typeof search.milestoneId === "string" ? search.milestoneId : undefined,
  }),
});
function MilestonesPage() {
  const { t } = useTranslation();
  const { projectId, workspaceId } = Route.useParams();
  const { milestoneId } = Route.useSearch();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"open" | "closed">("open");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [today, setToday] = useState(localDateString());
  useEffect(() => {
    const refresh = () => setToday(localDateString());
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const { canUpdateProjects, isAdmin } = useWorkspacePermission();
  const query = useMilestones(projectId, { status, page: String(page) });
  const mutations = useMilestoneMutations(projectId);
  const select = (id?: string) =>
    void navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/milestones",
      params: { projectId, workspaceId },
      search: { milestoneId: id },
    });
  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="milestones"
    >
      <PageTitle title={t("tasks:milestones.title")} />
      <div className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-6">
        {milestoneId ? (
          <MilestoneDetail
            key={milestoneId}
            id={milestoneId}
            projectId={projectId}
            workspaceId={workspaceId}
            onBack={() => select()}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="flex items-center gap-2 text-lg font-semibold">
                <Flag className="size-5" />
                {t("tasks:milestones.title")}
              </h1>
              {isAdmin && canUpdateProjects() && (
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Plus className="size-4" />
                  {t("tasks:milestones.create")}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {(["open", "closed"] as const).map((state) => (
                <Button
                  key={state}
                  variant={status === state ? "secondary" : "ghost"}
                  size="sm"
                  aria-pressed={status === state}
                  onClick={() => {
                    setStatus(state);
                    setPage(1);
                  }}
                >
                  {state === "open"
                    ? t("tasks:milestones.open")
                    : t("tasks:milestones.closed")}
                </Button>
              ))}
            </div>
            {query.isLoading && (
              <p role="status">{t("common:empty.loading")}</p>
            )}
            {query.isError && (
              <div role="alert">
                <p>{t("tasks:milestones.loadError")}</p>
                <Button variant="outline" onClick={() => void query.refetch()}>
                  {t("tasks:milestones.retry")}
                </Button>
              </div>
            )}
            {query.data?.data.length === 0 && (
              <div className="rounded-lg border border-dashed p-10 text-center">
                <Flag className="mx-auto mb-3 size-7 text-muted-foreground" />
                <p className="font-medium">{t("tasks:milestones.empty")}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("tasks:milestones.emptyDescription")}
                </p>
              </div>
            )}
            <div className="divide-y rounded-lg border">
              {query.data?.data.map((milestone) => (
                <button
                  key={milestone.id}
                  type="button"
                  className="flex w-full flex-wrap items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-accent"
                  onClick={() => select(milestone.id)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{milestone.name}</p>
                    <p
                      className={`mt-1 text-xs ${isMilestoneOverdue(milestone, today) ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {milestone.dueDate ?? t("tasks:milestones.noDate")}
                      {isMilestoneOverdue(milestone, today) &&
                        ` · ${t("tasks:milestones.overdue")}`}
                    </p>
                  </div>
                  <div className="w-44 space-y-1 text-xs">
                    <p>
                      {milestone.totalTasks
                        ? t("tasks:milestones.progress", {
                            completed: milestone.completedTasks,
                            total: milestone.totalTasks,
                          })
                        : t("tasks:milestones.noTasks")}
                    </p>
                    <progress
                      className="h-1.5 w-full accent-primary"
                      value={milestone.progressPercent}
                      max={100}
                      aria-label={t("tasks:milestones.progressLabel")}
                    />
                  </div>
                </button>
              ))}
            </div>
            {query.data && query.data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-end gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  {t("tasks:milestones.previous")}
                </Button>
                <span className="text-sm">
                  {page} / {query.data.pagination.totalPages}
                </span>
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
          </>
        )}
      </div>
      {creating && isAdmin && canUpdateProjects() && (
        <MilestoneForm
          onClose={() => setCreating(false)}
          onSave={(input) => mutations.create.mutateAsync(input)}
        />
      )}
    </ProjectLayout>
  );
}
