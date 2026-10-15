import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { addMonths, endOfMonth, startOfMonth, subMonths } from "date-fns";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import WeekendVisibilityControl from "@/components/calendar/weekend-visibility-control";
import { countHiddenWeekendTasks } from "@/lib/visible-schedule";
import CalendarToolbar from "@/components/calendar/calendar-toolbar";
import MonthGrid from "@/components/calendar/month-grid";
import { buildMonthWeeks } from "@/components/calendar/month-grid-model";
import ProjectLayout from "@/components/common/project-layout";
import MilestoneSelect from "@/components/milestone/milestone-select";
import PageTitle from "@/components/page-title";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { shortcuts } from "@/constants/shortcuts";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useMilestoneFilter } from "@/hooks/use-milestone-filter";
import { useIsMobile } from "@/hooks/use-mobile";
import { toScheduledTasks } from "@/lib/task-schedule";
import { useUserPreferencesStore } from "@/store/user-preferences";

type CalendarSearchParams = {
  taskId?: string;
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/calendar",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): CalendarSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

// Lanes are capped so a busy week cannot push a row taller than the viewport;
// anything past the cap surfaces as a per-day overflow hint.
const MAX_LANES_DESKTOP = 3;
const MAX_LANES_MOBILE = 2;

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId, workspaceId } = Route.useParams();
  const { taskId } = Route.useSearch();
  const { milestoneId, setMilestoneId } = useMilestoneFilter(projectId);
  const navigate = useNavigate();
  const { data: project, isLoading, isError } = useGetTasks(projectId);
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const showWeekends = useUserPreferencesStore(
    (state) => state.calendarShowWeekends,
  );
  const setShowWeekends = useUserPreferencesStore(
    (state) => state.setCalendarShowWeekends,
  );
  const setViewMode = useUserPreferencesStore((state) => state.setViewMode);
  const isMobile = useIsMobile();
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(new Date()),
  );

  const scheduledTasks = useMemo(
    () =>
      toScheduledTasks(project).filter(
        (task) => !milestoneId || (task.milestoneId ?? "none") === milestoneId,
      ),
    [project, milestoneId],
  );

  const weeks = useMemo(
    () => buildMonthWeeks(visibleMonth, weekStartsOn, showWeekends),
    [visibleMonth, weekStartsOn, showWeekends],
  );

  const handlePreviousMonth = useCallback(() => {
    setVisibleMonth((current) => subMonths(current, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setVisibleMonth((current) => addMonths(current, 1));
  }, []);

  const handleToday = useCallback(() => {
    setVisibleMonth(startOfMonth(new Date()));
  }, []);

  const handleOpenTask = useCallback(
    (nextTaskId: string) => {
      navigate({ to: ".", search: { taskId: nextTaskId }, replace: true });
    },
    [navigate],
  );

  const handleCloseTaskSheet = useCallback(() => {
    navigate({ to: ".", search: {}, replace: true });
  }, [navigate]);

  useRegisterShortcuts({
    sequentialShortcuts: {
      [shortcuts.view.prefix]: {
        [shortcuts.view.board]: () => {
          setViewMode("board");
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
            params: { workspaceId, projectId },
          });
        },
        [shortcuts.view.list]: () => {
          setViewMode("list");
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
            params: { workspaceId, projectId },
          });
        },
        [shortcuts.view.backlog]: () => {
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/backlog",
            params: { workspaceId, projectId },
          });
        },
        [shortcuts.view.gantt]: () => {
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/gantt",
            params: { workspaceId, projectId },
          });
        },
        [shortcuts.view.calendar]: () => {},
      },
    },
  });

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="calendar"
    >
      <PageTitle
        title={t("tasks:calendar.pageTitle", { name: project?.name })}
        hideAppName
      />
      <div className="flex h-full min-h-0 flex-col bg-background">
        <CalendarToolbar
          visibleMonth={visibleMonth}
          onPreviousMonth={handlePreviousMonth}
          onNextMonth={handleNextMonth}
          onToday={handleToday}
        >
          <MilestoneSelect
            projectId={projectId}
            value={milestoneId}
            onChange={setMilestoneId}
            filter
            includeClosed
          />
          <WeekendVisibilityControl
            checked={showWeekends}
            onCheckedChange={setShowWeekends}
            hiddenCount={countHiddenWeekendTasks(
              scheduledTasks,
              startOfMonth(visibleMonth),
              endOfMonth(visibleMonth),
            )}
          />
        </CalendarToolbar>

        {isLoading ? (
          <div className="border-b border-border/80 px-4 py-3 text-center">
            <p className="text-sm text-muted-foreground">
              {t("common:empty.loading")}
            </p>
          </div>
        ) : isError ? (
          <div className="border-b border-border/80 px-4 py-3 text-center">
            <p className="text-sm font-semibold text-destructive">
              {t("tasks:calendar.loadError")}
            </p>
          </div>
        ) : scheduledTasks.length === 0 ? (
          <div className="border-b border-border/80 px-4 py-3 text-center">
            <p className="text-sm font-semibold text-foreground">
              {t(
                milestoneId
                  ? "tasks:milestones.noTasks"
                  : "tasks:calendar.noTasks",
              )}
            </p>
            {!milestoneId && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("tasks:calendar.noTasksSubtitle")}
              </p>
            )}
          </div>
        ) : null}

        <MonthGrid
          weeks={weeks}
          tasks={scheduledTasks}
          visibleMonth={visibleMonth}
          maxLanes={isMobile ? MAX_LANES_MOBILE : MAX_LANES_DESKTOP}
          projectSlug={project?.slug}
          onOpenTask={handleOpenTask}
        />

        <TaskDetailsSheet
          taskId={taskId}
          projectId={projectId}
          workspaceId={workspaceId}
          onClose={handleCloseTaskSheet}
        />
      </div>
    </ProjectLayout>
  );
}
