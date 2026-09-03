import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { addWeeks, endOfWeek, isWithinInterval, startOfWeek } from "date-fns";
import { Filter, UserRoundX, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import SortControl from "@/components/common/sort-control";
import HierarchyView from "@/components/hierarchy-view";
import PageTitle from "@/components/page-title";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import labelColors from "@/constants/label-colors";
import useGetLabelsByWorkspace from "@/hooks/queries/label/use-get-labels-by-workspace";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import useWorkspaceTeams from "@/hooks/queries/workspace/use-workspace-teams";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import {
  DUE_DATE_FILTER_VALUES,
  UNASSIGNED_FILTER_VALUE,
} from "@/hooks/use-task-filters";
import { isTaskCompleted } from "@/lib/due-date-status";
import type { SortConfig } from "@/lib/sort-tasks";
import { sortTasks } from "@/lib/sort-tasks";
import useProjectStore from "@/store/project";
import { useUserPreferencesStore } from "@/store/user-preferences";

type HierarchySearchParams = { taskId?: string };
type CompletionFilter = "all" | "open" | "completed";
type DueDateFilter =
  | "all"
  | (typeof DUE_DATE_FILTER_VALUES)[keyof typeof DUE_DATE_FILTER_VALUES];

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
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(workspaceId);
  const { data: workspaceTeams = [] } = useWorkspaceTeams(workspaceId);
  const { data: workspaceLabels = [] } = useGetLabelsByWorkspace(workspaceId);
  const { project, setProject } = useProjectStore();
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const [completionFilter, setCompletionFilter] =
    useState<CompletionFilter>("all");
  const [assigneeFilters, setAssigneeFilters] = useState<string[]>([]);
  const [dueDateFilter, setDueDateFilter] = useState<DueDateFilter>("all");
  const [labelFilters, setLabelFilters] = useState<string[]>([]);
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

  const visibleTasks = useMemo(() => {
    if (!project) return [];

    const tasks = [
      ...project.plannedTasks,
      ...project.columns.flatMap((column) => column.tasks),
    ].filter((task) => {
      if (completionFilter !== "all") {
        const completed = isTaskCompleted(task.status, project.columns);
        if (completionFilter === "completed" ? !completed : completed) {
          return false;
        }
      }

      if (
        assigneeFilters.length > 0 &&
        !assigneeFilters.includes(task.userId ?? UNASSIGNED_FILTER_VALUE)
      ) {
        return false;
      }

      if (dueDateFilter !== "all") {
        if (dueDateFilter === DUE_DATE_FILTER_VALUES.noDueDate) {
          if (task.dueDate) return false;
        } else {
          if (!task.dueDate) return false;
          const today = new Date();
          const taskDate = new Date(task.dueDate);
          const weekOffset =
            dueDateFilter === DUE_DATE_FILTER_VALUES.dueNextWeek ? 1 : 0;
          const targetDate = addWeeks(today, weekOffset);
          if (
            !isWithinInterval(taskDate, {
              start: startOfWeek(targetDate, { weekStartsOn }),
              end: endOfWeek(targetDate, { weekStartsOn }),
            })
          ) {
            return false;
          }
        }
      }

      if (
        labelFilters.length > 0 &&
        !labelFilters.some((labelId) =>
          task.labels?.some((label) => label.id === labelId),
        )
      ) {
        return false;
      }

      return true;
    });

    return sortTasks(tasks, sort);
  }, [
    assigneeFilters,
    completionFilter,
    dueDateFilter,
    labelFilters,
    project,
    sort,
    weekStartsOn,
  ]);

  const activeFilterCount =
    Number(completionFilter !== "all") +
    Number(assigneeFilters.length > 0) +
    Number(dueDateFilter !== "all") +
    Number(labelFilters.length > 0);
  const selectedAssignee = workspaceUsers?.members?.find(
    (member) => member.userId === assigneeFilters[0],
  );
  const toggleAssigneeFilter = (userId: string) => {
    setAssigneeFilters((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  };
  const toggleTeamMembers = (userIds: string[]) => {
    if (userIds.length === 0) return;
    setAssigneeFilters((current) => {
      const allSelected = userIds.every((userId) => current.includes(userId));
      return allSelected
        ? current.filter((userId) => !userIds.includes(userId))
        : [...new Set([...current, ...userIds])];
    });
  };
  const filterLabel =
    activeFilterCount === 0
      ? t("tasks:hierarchy.filters.all")
      : activeFilterCount === 1
        ? completionFilter !== "all"
          ? t(`tasks:hierarchy.filters.${completionFilter}`)
          : assigneeFilters.length === 1 &&
              assigneeFilters[0] === UNASSIGNED_FILTER_VALUE
            ? t("tasks:hierarchy.filters.unassigned")
            : assigneeFilters.length > 0
              ? assigneeFilters.length === 1
                ? (selectedAssignee?.user?.name ??
                  t("tasks:hierarchy.filters.assignee"))
                : t("tasks:boardFilters.selectedCount", {
                    count: assigneeFilters.length,
                  })
              : dueDateFilter !== "all"
                ? t(`tasks:hierarchy.filters.${dueDateFilter}`)
                : t("tasks:hierarchy.filters.labels")
        : t("tasks:hierarchy.filters.selected", {
            count: activeFilterCount,
          });
  const hierarchyToolbar = (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border/80 bg-background px-3 sm:px-4">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant={activeFilterCount === 0 ? "outline" : "secondary"}
              size="sm"
              className="h-7 gap-1.5 px-2.5 text-xs"
            />
          }
        >
          <Filter className="size-3.5" />
          {filterLabel}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              {t("tasks:hierarchy.filters.label")}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={completionFilter}
            onValueChange={(value) =>
              setCompletionFilter(value as CompletionFilter)
            }
          >
            <DropdownMenuRadioItem value="all">
              {t("tasks:hierarchy.filters.all")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="open">
              {t("tasks:hierarchy.filters.open")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="completed">
              {t("tasks:hierarchy.filters.completed")}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              {t("tasks:hierarchy.filters.assignee")}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setAssigneeFilters([])}>
              {t("tasks:hierarchy.filters.allAssignees")}
            </DropdownMenuItem>
            <DropdownMenuCheckboxItem
              checked={assigneeFilters.includes(UNASSIGNED_FILTER_VALUE)}
              indicatorVariant="checkbox"
              onCheckedChange={() =>
                toggleAssigneeFilter(UNASSIGNED_FILTER_VALUE)
              }
            >
              <UserRoundX className="size-4 text-muted-foreground" />
              {t("tasks:hierarchy.filters.unassigned")}
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            {workspaceTeams.map((team) => {
              const teamMembers = (workspaceUsers?.members ?? []).filter(
                (member) => team.userIds.includes(member.userId),
              );
              const teamUserIds = teamMembers.map((member) => member.userId);
              return (
                <DropdownMenuSub key={team.id}>
                  <DropdownMenuSubTrigger>
                    <UsersRound className="size-4 text-muted-foreground" />
                    <span className="truncate">{team.name}</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-64">
                    {teamMembers.length > 0 ? (
                      <>
                        <DropdownMenuCheckboxItem
                          checked={teamUserIds.every((userId) =>
                            assigneeFilters.includes(userId),
                          )}
                          indicatorVariant="checkbox"
                          onCheckedChange={() => toggleTeamMembers(teamUserIds)}
                        >
                          <UsersRound className="size-4 text-muted-foreground" />
                          {t("tasks:boardFilters.allTeamMembers")}
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuSeparator />
                        {teamMembers.map((member) => (
                          <DropdownMenuCheckboxItem
                            key={member.userId}
                            checked={assigneeFilters.includes(member.userId)}
                            indicatorVariant="checkbox"
                            onCheckedChange={() =>
                              toggleAssigneeFilter(member.userId)
                            }
                          >
                            {member.user?.name ?? member.user?.email}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </>
                    ) : (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        {t("tasks:boardFilters.noTeamMembers")}
                      </div>
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              );
            })}
            {workspaceTeams.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                {t("tasks:boardFilters.noTeams")}
              </div>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              {t("tasks:hierarchy.filters.dueDate")}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={dueDateFilter}
            onValueChange={(value) => setDueDateFilter(value as DueDateFilter)}
          >
            <DropdownMenuRadioItem value="all">
              {t("tasks:hierarchy.filters.allDueDates")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value={DUE_DATE_FILTER_VALUES.dueThisWeek}>
              {t("tasks:hierarchy.filters.dueThisWeek")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value={DUE_DATE_FILTER_VALUES.dueNextWeek}>
              {t("tasks:hierarchy.filters.dueNextWeek")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value={DUE_DATE_FILTER_VALUES.noDueDate}>
              {t("tasks:hierarchy.filters.noDueDate")}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              {t("tasks:hierarchy.filters.labels")}
            </DropdownMenuLabel>
            {workspaceLabels.map((label) => (
              <DropdownMenuCheckboxItem
                key={label.id}
                checked={labelFilters.includes(label.id)}
                onCheckedChange={() =>
                  setLabelFilters((current) =>
                    current.includes(label.id)
                      ? current.filter((id) => id !== label.id)
                      : [...current, label.id],
                  )
                }
              >
                <span
                  className="size-2.5 rounded-full"
                  style={{
                    backgroundColor:
                      labelColors.find((color) => color.value === label.color)
                        ?.color ?? "var(--color-stone-500)",
                  }}
                />
                {label.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
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
