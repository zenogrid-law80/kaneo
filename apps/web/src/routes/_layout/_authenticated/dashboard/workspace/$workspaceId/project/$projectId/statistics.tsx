import { createFileRoute, Link } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import MonthlyTaskChart from "@/components/statistics/monthly-task-chart";
import {
  type Counts,
  dateRange,
  type Month,
  type StatisticsSearch,
  selectMembers,
  totalCounts,
  totalMonths,
  validateStatisticsSearch,
} from "@/components/statistics/statistics-model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import useMemberTeamMonthlyStatistics from "@/hooks/queries/workspace/use-member-team-monthly-statistics";
import useWorkspaceMemberStatistics from "@/hooks/queries/workspace/use-workspace-member-statistics";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/statistics",
)({ component: RouteComponent, validateSearch: validateStatisticsSearch });

function RouteComponent() {
  const { t } = useTranslation();
  const { canManageWorkspace, isCheckingPermissions } =
    useWorkspacePermission();
  const { workspaceId, projectId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [initialRange] = useState(() => dateRange());
  const startDate = search.startDate ?? initialRange.startDate;
  const endDate =
    search.endDate ??
    (startDate > initialRange.endDate ? startDate : initialRange.endDate);
  const effectiveStart = startDate > endDate ? endDate : startDate;
  const memberId = search.member ?? "all";
  const teamId = search.team ?? "all";
  const schedule = search.schedule ?? "all";
  const canView = canManageWorkspace();
  const summary = useWorkspaceMemberStatistics(
    canView ? workspaceId : "",
    projectId,
    effectiveStart,
    endDate,
  );
  const people = useMemberTeamMonthlyStatistics(
    canView ? workspaceId : "",
    projectId,
    effectiveStart,
    endDate,
  );
  const teams = people.data?.teams ?? [];
  const selectedTeam = teams.find((team) => team.teamId === teamId);
  const members = people.data?.members ?? [];
  const eligibleMembers = members.filter(
    (member) =>
      teamId === "all" || selectedTeam?.userIds.includes(member.userId),
  );
  const visibleSummary = selectMembers(summary.data ?? [], teams, {
    member: memberId,
    team: teamId,
    schedule,
  });
  const visibleIds = new Set(visibleSummary.map((member) => member.userId));
  const visibleMembers = members.filter((member) =>
    visibleIds.has(member.userId),
  );
  const totals = totalCounts(visibleSummary);
  const monthsByMember = new Map(
    visibleMembers.map((member) => [member.userId, member.months]),
  );
  const memberItems: DetailItem[] = visibleSummary.map((member) => ({
    ...member,
    id: member.userId,
    months: monthsByMember.get(member.userId) ?? [],
  }));
  const teamItems: DetailItem[] = teams
    .filter(
      (team) =>
        (teamId === "all" || team.teamId === teamId) &&
        team.userIds.some((id) => visibleIds.has(id)),
    )
    .map((team) => {
      const rows = memberItems.filter((member) =>
        team.userIds.includes(member.id),
      );
      return {
        id: team.teamId,
        name: team.teamName,
        ...totalCounts(rows),
        months: totalMonths(rows),
        overdueTaskItems: rows.flatMap((member) => member.overdueTaskItems),
      };
    });
  const overdueTasks = visibleSummary.flatMap((member) =>
    member.overdueTaskItems.map((task) => ({
      ...task,
      memberName: member.name,
    })),
  );
  const update = (next: Partial<StatisticsSearch>) => {
    void navigate({
      search: (previous: StatisticsSearch) => ({
        ...previous,
        startDate: effectiveStart,
        endDate,
        ...next,
      }),
      replace: true,
    });
  };
  const isLoading = summary.isLoading || people.isLoading;
  const isError = summary.isError || people.isError;
  const metrics = [
    { label: t("statistics:columns.assigned"), value: totals.assignedTasks },
    { label: t("statistics:columns.completed"), value: totals.completedTasks },
    { label: t("statistics:renewal.open"), value: totals.inProgressTasks },
    {
      label: t("statistics:columns.overdue"),
      value: totals.overdueTasks,
      danger: totals.overdueTasks > 0,
    },
    {
      label: t("statistics:columns.completionRate"),
      value: `${totals.completionRate}%`,
    },
  ];

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="statistics"
    >
      <PageTitle title={t("statistics:pageTitle")} />
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">
            {t("statistics:pageTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("statistics:renewal.description")}
          </p>
        </div>
        {isCheckingPermissions ? (
          <Skeleton className="h-96 w-full" />
        ) : !canView ? (
          <EmptyState text={t("settings:workspaceRoles.noAccess")} />
        ) : (
          <>
            <section
              aria-label={t("statistics:renewal.filters")}
              className="space-y-3 rounded-xl border bg-muted/20 p-4"
            >
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "recent", label: t("statistics:renewal.recent") },
                  {
                    value: "thisMonth",
                    label: t("statistics:renewal.thisMonth"),
                  },
                  {
                    value: "lastMonth",
                    label: t("statistics:renewal.lastMonth"),
                  },
                ].map((preset) => {
                  const range = dateRange(preset.value);
                  const active =
                    effectiveStart === range.startDate &&
                    endDate === range.endDate;
                  return (
                    <Button
                      key={preset.value}
                      type="button"
                      size="sm"
                      variant={active ? "secondary" : "ghost"}
                      aria-pressed={active}
                      onClick={() => update(range)}
                    >
                      {preset.label}
                    </Button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <DateFilter
                  label={t("statistics:filters.startDate")}
                  value={effectiveStart}
                  max={endDate}
                  onChange={(value) =>
                    update({
                      startDate: value,
                      endDate: value > endDate ? value : endDate,
                    })
                  }
                />
                <DateFilter
                  label={t("statistics:filters.endDate")}
                  value={endDate}
                  min={effectiveStart}
                  onChange={(value) =>
                    update({
                      endDate: value,
                      startDate:
                        value < effectiveStart ? value : effectiveStart,
                    })
                  }
                />
                <StatisticFilter
                  label={t("statistics:filters.team")}
                  value={teamId}
                  onValueChange={(value) =>
                    update({ team: value, member: "all" })
                  }
                  options={[
                    { value: "all", label: t("statistics:filters.allTeams") },
                    { value: "none", label: t("statistics:filters.noTeam") },
                    ...teams.map((team) => ({
                      value: team.teamId,
                      label: team.teamName,
                    })),
                  ]}
                />
                <StatisticFilter
                  label={t("statistics:filters.member")}
                  value={memberId}
                  onValueChange={(value) => update({ member: value })}
                  options={[
                    { value: "all", label: t("statistics:filters.allMembers") },
                    { value: "none", label: t("statistics:filters.noMember") },
                    ...eligibleMembers.map((member) => ({
                      value: member.userId,
                      label: member.name,
                    })),
                  ]}
                />
                <StatisticFilter
                  label={t("statistics:renewal.scheduleMembers")}
                  value={schedule}
                  onValueChange={(value) =>
                    update({ schedule: value as StatisticsSearch["schedule"] })
                  }
                  options={[
                    { value: "all", label: t("statistics:filters.allMembers") },
                    {
                      value: "overdue",
                      label: t("statistics:renewal.hasOverdue"),
                    },
                    {
                      value: "onTrack",
                      label: t("statistics:renewal.noOverdue"),
                    },
                  ]}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    update({
                      ...dateRange(),
                      member: "all",
                      team: "all",
                      schedule: "all",
                    })
                  }
                >
                  <RotateCcw />
                  {t("statistics:filters.reset")}
                </Button>
              </div>
            </section>
            {isError ? (
              <div role="alert" className="rounded-xl border p-6 text-center">
                <p>{t("statistics:renewal.error")}</p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3"
                  onClick={() => {
                    void summary.refetch();
                    void people.refetch();
                  }}
                >
                  {t("statistics:renewal.retry")}
                </Button>
              </div>
            ) : isLoading ? (
              <div
                role="status"
                aria-label={t("statistics:renewal.loading")}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                  {metrics.map((metric) => (
                    <Skeleton key={metric.label} className="h-24" />
                  ))}
                </div>
                <Skeleton className="h-80" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                  {metrics.map((metric) => (
                    <div key={metric.label} className="rounded-xl border p-4">
                      <p className="text-sm text-muted-foreground">
                        {metric.label}
                      </p>
                      <p
                        className={`mt-2 text-3xl font-semibold tabular-nums ${metric.danger ? "text-destructive" : ""}`}
                      >
                        {metric.value}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("statistics:renewal.summaryBasis")}
                </p>
                {memberId === "none" || teamId === "none" ? (
                  <EmptyState text={t("statistics:renewal.noneSelected")} />
                ) : visibleSummary.length === 0 ? (
                  <EmptyState text={t("statistics:filters.noResults")} />
                ) : (
                  <Tabs
                    value={search.view ?? "overview"}
                    onValueChange={(value) =>
                      update({ view: value as StatisticsSearch["view"] })
                    }
                  >
                    <TabsList
                      variant="underline"
                      aria-label={t("statistics:pageTitle")}
                    >
                      <TabsTab value="overview">
                        {t("statistics:renewal.overview")}
                      </TabsTab>
                      <TabsTab value="members">
                        {t("statistics:filters.member")}
                      </TabsTab>
                      <TabsTab value="teams">
                        {t("statistics:filters.team")}
                      </TabsTab>
                    </TabsList>
                    <TabsPanel value="overview" className="space-y-5 pt-4">
                      <section className="space-y-4 rounded-xl border p-4 sm:p-6">
                        <h2 className="font-semibold">
                          {t("statistics:renewal.trend")}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                          {t("statistics:renewal.trendBasis")}
                        </p>
                        <MonthlyTaskChart
                          points={totalMonths(visibleMembers)}
                        />
                      </section>
                      <section className="space-y-4 rounded-xl border p-4 sm:p-6">
                        <h2 className="font-semibold">
                          {t("statistics:columns.overdue")} ·{" "}
                          {overdueTasks.length}
                        </h2>
                        <OverdueList
                          tasks={overdueTasks}
                          workspaceId={workspaceId}
                        />
                      </section>
                    </TabsPanel>
                    <TabsPanel value="members" className="pt-4">
                      <DetailSection
                        items={memberItems}
                        workspaceId={workspaceId}
                      />
                    </TabsPanel>
                    <TabsPanel value="teams" className="space-y-4 pt-4">
                      <p className="text-xs text-muted-foreground">
                        {t("statistics:renewal.teamBasis")}
                      </p>
                      <DetailSection
                        items={teamItems}
                        workspaceId={workspaceId}
                      />
                    </TabsPanel>
                  </Tabs>
                )}
              </>
            )}
          </>
        )}
      </div>
    </ProjectLayout>
  );
}

type OverdueTask = {
  id: string;
  title: string;
  projectId: string;
  memberName?: string;
};
type DetailItem = Counts & {
  id: string;
  name: string;
  months: Month[];
  overdueTaskItems: OverdueTask[];
};

function DetailSection({
  items,
  workspaceId,
}: {
  items: DetailItem[];
  workspaceId: string;
}) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string>();
  const selected = items.find((item) => item.id === selectedId);
  if (!items.length)
    return <EmptyState text={t("statistics:filters.noResults")} />;
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {t("statistics:renewal.selectDetail")}
      </p>
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("statistics:renewal.name")}</TableHead>
              <TableHead className="text-right">
                {t("statistics:columns.assigned")}
              </TableHead>
              <TableHead className="text-right">
                {t("statistics:columns.completed")}
              </TableHead>
              <TableHead className="text-right">
                {t("statistics:renewal.open")}
              </TableHead>
              <TableHead className="text-right">
                {t("statistics:columns.overdue")}
              </TableHead>
              <TableHead>{t("statistics:columns.completionRate")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const rate = totalCounts([item]).completionRate;
              return (
                <TableRow
                  key={item.id}
                  className={selected?.id === item.id ? "bg-muted/50" : ""}
                >
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="max-w-64 justify-start truncate"
                      aria-pressed={selected?.id === item.id}
                      onClick={() =>
                        setSelectedId(
                          selected?.id === item.id ? undefined : item.id,
                        )
                      }
                    >
                      {item.name}
                    </Button>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.assignedTasks}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.completedTasks}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.inProgressTasks}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${item.overdueTasks ? "text-destructive" : ""}`}
                  >
                    {item.overdueTasks}
                  </TableCell>
                  <TableCell>
                    <div className="flex min-w-28 items-center gap-3">
                      <Progress
                        value={rate}
                        aria-label={t("statistics:columns.completionRate")}
                      />
                      <span className="text-sm tabular-nums">{rate}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {selected ? (
        <section className="space-y-4 rounded-xl border p-4 sm:p-6">
          <h2 className="font-semibold">{selected.name}</h2>
          <p className="text-xs text-muted-foreground">
            {t("statistics:renewal.trendBasis")}
          </p>
          <MonthlyTaskChart points={selected.months} />
          <h3 className="text-sm font-medium">
            {t("statistics:columns.overdue")}
          </h3>
          <OverdueList
            tasks={selected.overdueTaskItems}
            workspaceId={workspaceId}
          />
        </section>
      ) : null}
    </div>
  );
}

function OverdueList({
  tasks,
  workspaceId,
}: {
  tasks: OverdueTask[];
  workspaceId: string;
}) {
  const { t } = useTranslation();
  return tasks.length ? (
    <ul className="max-h-80 divide-y overflow-y-auto">
      {tasks.map((task) => (
        <li
          key={task.id}
          className="flex items-center justify-between gap-4 py-3 text-sm"
        >
          <Link
            to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
            params={{ workspaceId, projectId: task.projectId, taskId: task.id }}
            className="min-w-0 truncate text-primary underline-offset-4 hover:underline"
            title={task.title}
          >
            {task.title}
          </Link>
          {task.memberName ? (
            <span className="shrink-0 text-xs text-muted-foreground">
              {task.memberName}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-sm text-muted-foreground">
      {t("statistics:renewal.noOverdueTasks")}
    </p>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function DateFilter({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="min-w-36 flex-1 space-y-1 text-xs text-muted-foreground">
      <label htmlFor={id}>{label}</label>
      <Input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(event) => event.target.value && onChange(event.target.value)}
        className="h-8"
      />
    </div>
  );
}

function StatisticFilter({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const { t } = useTranslation();
  return (
    <div className="min-w-36 flex-1 space-y-1 text-xs text-muted-foreground">
      <span>{label}</span>
      <Select
        items={Object.fromEntries(
          options.map((option) => [option.value, option.label]),
        )}
        value={value}
        onValueChange={(next) => next && onValueChange(next)}
      >
        <SelectTrigger size="sm" aria-label={label}>
          <SelectValue>
            {options.find((option) => option.value === value)?.label ??
              t("statistics:renewal.unavailable")}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
