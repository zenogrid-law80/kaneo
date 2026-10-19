import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import SortControl from "@/components/common/sort-control";
import HierarchyView from "@/components/hierarchy-view";
import MilestoneSelect from "@/components/milestone/milestone-select";
import PageTitle from "@/components/page-title";
import ProjectTaskFilters from "@/components/project-task-filters";
import { useProjectTaskFilters } from "@/components/project-task-filters/use-project-task-filters";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import type { SortConfig } from "@/lib/sort-tasks";
import { sortTasks } from "@/lib/sort-tasks";
import useProjectStore from "@/store/project";

type HierarchySearchParams = { taskId?: string };

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/hierarchy",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): HierarchySearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId, workspaceId } = Route.useParams();
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  const { data } = useGetTasks(projectId);
  const { project, setProject } = useProjectStore();
  const filters = useProjectTaskFilters(project, projectId);
  const { milestoneId, setMilestoneId } = filters;
  const [sort, setSort] = useState<SortConfig>({
    field: "position",
    direction: "asc",
  });

  useEffect(() => {
    if (data) setProject(data);
  }, [data, setProject]);

  const closeTask = useCallback(() => {
    navigate({ to: ".", search: {}, replace: true });
  }, [navigate]);

  const visibleTasks = useMemo(
    () => sortTasks(filters.visibleTasks, sort),
    [filters.visibleTasks, sort],
  );
  const hierarchyToolbar = (
    <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-2 border-b border-border/80 bg-background px-3 py-1.5 sm:px-4">
      <MilestoneSelect
        projectId={projectId}
        value={milestoneId}
        onChange={setMilestoneId}
        filter
        includeClosed
      />
      <ProjectTaskFilters
        project={project}
        workspaceId={workspaceId}
        filters={filters}
      />
      <SortControl sort={sort} onSortChange={setSort} />
    </div>
  );

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="hierarchy"
    >
      <PageTitle
        title={`${project?.name ?? ""} · ${t("tasks:hierarchy.title")}`}
        hideAppName
      />
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {hierarchyToolbar}
        <div className="min-h-0 flex-1 overflow-hidden">
          {project ? (
            <HierarchyView
              project={project}
              tasks={visibleTasks}
              onOpenTask={(nextTaskId) =>
                navigate({ to: ".", search: { taskId: nextTaskId } })
              }
            />
          ) : (
            <div className="h-full animate-pulse bg-muted/20" />
          )}
        </div>
        <TaskDetailsSheet
          taskId={taskId}
          projectId={projectId}
          workspaceId={workspaceId}
          onClose={closeTask}
        />
      </div>
    </ProjectLayout>
  );
}
