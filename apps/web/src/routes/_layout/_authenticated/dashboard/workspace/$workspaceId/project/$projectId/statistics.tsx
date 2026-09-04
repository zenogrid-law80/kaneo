import { createFileRoute, Link } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import MonthlyTaskChart from "@/components/statistics/monthly-task-chart";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import useMemberTeamMonthlyStatistics from "@/hooks/queries/workspace/use-member-team-monthly-statistics";
import useProjectMonthlyStatistics from "@/hooks/queries/workspace/use-project-monthly-statistics";
import useWorkspaceMemberStatistics from "@/hooks/queries/workspace/use-workspace-member-statistics";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { getInitials } from "@/lib/get-initials";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/statistics",
)({ component: RouteComponent });

function RouteComponent() {
  const { t } = useTranslation();
  const { canManageWorkspace, isCheckingPermissions } =
    useWorkspacePermission();
  const { workspaceId: routeWorkspaceId, projectId } = Route.useParams();
  const canViewStatistics = canManageWorkspace();
  const workspaceId = canViewStatistics ? routeWorkspaceId : "";
  const [initialRange] = useState(getDefaultDateRange);
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const { data: statistics = [], isLoading } = useWorkspaceMemberStatistics(
    workspaceId,
    projectId,
    startDate,
    endDate,
  );
  const { data: projectStatistics = [], isLoading: areProjectsLoading } =
    useProjectMonthlyStatistics(workspaceId, projectId, startDate, endDate);
  const { data: memberTeamStatistics, isLoading: arePeopleLoading } =
    useMemberTeamMonthlyStatistics(workspaceId, projectId, startDate, endDate);
  const [memberId, setMemberId] = useState("all");
  const [teamId, setTeamId] = useState("all");
  const [schedule, setSchedule] = useState("all");
  const matchesSchedule = (overdueTasks: number) =>
    schedule === "all" ||
    (schedule === "overdue" ? overdueTasks > 0 : overdueTasks === 0);
  const visibleProjects = projectStatistics.filter(
    (project) =>
      project.projectId === projectId && matchesSchedule(project.overdueTasks),
  );
  const members = memberTeamStatistics?.members ?? [];
  const teams = memberTeamStatistics?.teams ?? [];
  const selectedTeam = teams.find((team) => team.teamId === teamId);
  const visibleMemberIds = selectedTeam ? new Set(selectedTeam.userIds) : null;
  const visibleMembers = members
    .filter(
      (member) =>
        memberId !== "none" &&
        (memberId === "all" || member.userId === memberId) &&
        (!visibleMemberIds || visibleMemberIds.has(member.userId)),
    )
    .filter((member) => matchesSchedule(member.overdueTasks));
  const visibleTeams = teams.filter(
    (team) =>
      teamId !== "none" &&
      (teamId === "all" || team.teamId === teamId) &&
      matchesSchedule(team.overdueTasks),
  );
  const visibleSummary = statistics
    .filter(
      (member) =>
        memberId !== "none" &&
        (memberId === "all" || member.userId === memberId) &&
        (!visibleMemberIds || visibleMemberIds.has(member.userId)),
    )
    .filter((member) => matchesSchedule(member.overdueTasks));
  const hasActiveFilters =
    startDate !== initialRange.startDate ||
    endDate !== initialRange.endDate ||
    schedule !== "all" ||
    memberId !== "all" ||
    teamId !== "all";

  const resetFilters = () => {
    setStartDate(initialRange.startDate);
    setEndDate(initialRange.endDate);
    setSchedule("all");
    setMemberId("all");
    setTeamId("all");
  };

  if (isCheckingPermissions) {
    return (
      <ProjectLayout
        projectId={projectId}
        workspaceId={routeWorkspaceId}
        activeView="statistics"
      >
        <Skeleton className="mx-auto h-96 w-full max-w-6xl" />
      </ProjectLayout>
    );
  }

  if (!canViewStatistics) {
    return (
      <ProjectLayout
        projectId={projectId}
        workspaceId={routeWorkspaceId}
        activeView="statistics"
      >
        <div className="mx-auto max-w-6xl rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t("settings:workspaceRoles.noAccess", {
            defaultValue: "You do not have access to workspace statistics.",
          })}
        </div>
      </ProjectLayout>
    );
  }

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={routeWorkspaceId}
      activeView="statistics"
    >
      <PageTitle title={t("statistics:pageTitle")} />
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {t("statistics:pageTitle")}
          </h1>
          <p className="text-muted-foreground">{t("statistics:description")}</p>
        </div>
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/20 p-3">
            <DateFilter
              label={t("statistics:filters.startDate")}
              value={startDate}
              max={endDate}
              onChange={(value) => {
                setStartDate(value);
                if (value > endDate) setEndDate(value);
              }}
            />
            <DateFilter
              label={t("statistics:filters.endDate")}
              value={endDate}
              min={startDate}
              onChange={(value) => {
                setEndDate(value);
                if (value < startDate) setStartDate(value);
              }}
            />
            <StatisticFilter
              label={t("statistics:filters.team")}
              value={teamId}
              onValueChange={(value) => {
                setTeamId(value);
                if (
                  value !== "all" &&
                  memberId !== "all" &&
                  memberId !== "none" &&
                  !teams
                    .find((team) => team.teamId === value)
                    ?.userIds.includes(memberId)
                ) {
                  setMemberId("all");
                }
              }}
              options={[
                {
                  value: "none",
                  label: t("statistics:filters.noTeam"),
                },
                { value: "all", label: t("statistics:filters.allTeams") },
                ...teams.map((team) => ({
                  value: team.teamId,
                  label: team.teamName,
                })),
              ]}
            />
            <StatisticFilter
              label={t("statistics:filters.member")}
              value={memberId}
              onValueChange={setMemberId}
              options={[
                {
                  value: "none",
                  label: t("statistics:filters.noMember"),
                },
                { value: "all", label: t("statistics:filters.allMembers") },
                ...members
                  .filter(
                    (member) =>
                      !selectedTeam ||
                      selectedTeam.userIds.includes(member.userId),
                  )
                  .map((member) => ({
                    value: member.userId,
                    label: member.name,
                  })),
              ]}
            />
            <StatisticFilter
              label={t("statistics:filters.schedule")}
              value={schedule}
              onValueChange={setSchedule}
              options={[
                { value: "all", label: t("statistics:filters.allSchedules") },
                { value: "overdue", label: t("statistics:filters.overdue") },
                { value: "onTrack", label: t("statistics:filters.onTrack") },
              ]}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!hasActiveFilters}
              onClick={resetFilters}
            >
              <RotateCcw />
              {t("statistics:filters.reset")}
            </Button>
          </div>
          <div>
            <h2 className="text-base font-semibold">
              {t("statistics:memberPerformance")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("statistics:description")}
            </p>
          </div>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("statistics:columns.member")}</TableHead>
                  <TableHead className="text-right">
                    {t("statistics:columns.assigned")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("statistics:columns.completed")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("statistics:columns.inProgress")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("statistics:columns.overdue")}
                  </TableHead>
                  <TableHead className="min-w-44">
                    {t("statistics:columns.completionRate")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? ["first", "second", "third"].map((key) => (
                      <TableRow key={key}>
                        <TableCell colSpan={6}>
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : visibleSummary.map((member) => (
                      <TableRow key={member.userId}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <Avatar className="size-8">
                              <AvatarImage src={member.image ?? undefined} />
                              <AvatarFallback>
                                {getInitials(member.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div
                                id={`member-${member.userId}-name`}
                                className="truncate font-medium"
                              >
                                {member.name}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {member.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {member.assignedTasks}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {member.completedTasks}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {member.inProgressTasks}
                        </TableCell>
                        <TableCell>
                          <OverdueTasks
                            count={member.overdueTasks}
                            tasks={member.overdueTaskItems}
                            workspaceId={workspaceId}
                            align="end"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Progress
                              value={member.completionRate}
                              aria-labelledby={`member-${member.userId}-name`}
                            />
                            <span className="w-10 text-right text-sm tabular-nums">
                              {member.completionRate}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-4 pt-4">
            <div>
              <h2 className="text-base font-semibold">
                {t("statistics:monthly.title")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("statistics:monthly.description")}
              </p>
            </div>
            {areProjectsLoading
              ? ["first", "second"].map((key) => (
                  <Skeleton key={key} className="h-72 w-full" />
                ))
              : visibleProjects.map((project) => (
                  <section
                    key={project.projectId}
                    className="rounded-md border p-4"
                  >
                    <div className="mb-4 space-y-1.5">
                      <h3 className="text-sm font-medium">
                        {project.projectName}
                      </h3>
                      <OverdueTasks
                        count={project.overdueTasks}
                        tasks={project.overdueTaskItems}
                        workspaceId={workspaceId}
                      />
                    </div>
                    <MonthlyTaskChart points={project.months} />
                  </section>
                ))}
            {!areProjectsLoading && visibleProjects.length === 0 ? (
              <FilteredEmptyState />
            ) : null}
          </div>
          <MonthlyStatisticsSection
            title={t("statistics:monthly.membersTitle")}
            description={t("statistics:monthly.membersDescription")}
            workspaceId={workspaceId}
            isLoading={arePeopleLoading}
            items={visibleMembers.map((member) => ({
              id: member.userId,
              name: member.name,
              subtitle: member.email,
              overdueTasks: member.overdueTasks,
              overdueTaskItems: member.overdueTaskItems,
              months: member.months,
            }))}
          />
          <MonthlyStatisticsSection
            title={t("statistics:monthly.teamsTitle")}
            description={t("statistics:monthly.teamsDescription")}
            workspaceId={workspaceId}
            isLoading={arePeopleLoading}
            items={visibleTeams.map((team) => ({
              id: team.teamId,
              name: team.teamName,
              overdueTasks: team.overdueTasks,
              overdueTaskItems: team.overdueTaskItems,
              months: team.months,
            }))}
          />
        </div>
      </div>
    </ProjectLayout>
  );
}

function OverdueBadge({ count }: { count: number }) {
  const { t } = useTranslation();
  return count > 0 ? (
    <Badge variant="destructive">
      {t("statistics:overdueCount", { count })}
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      {t("statistics:onTrack")}
    </Badge>
  );
}

type OverdueTask = {
  id: string;
  title: string;
  projectId: string;
};

function OverdueTasks({
  count,
  tasks,
  workspaceId,
  align = "start",
}: {
  count: number;
  tasks: OverdueTask[];
  workspaceId: string;
  align?: "start" | "end";
}) {
  return (
    <div
      className={`flex flex-col gap-1.5 ${align === "end" ? "items-end" : "items-start"}`}
    >
      <OverdueBadge count={count} />
      {tasks.map((task) => (
        <Link
          key={task.id}
          to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
          params={{
            workspaceId,
            projectId: task.projectId,
            taskId: task.id,
          }}
          className="max-w-56 truncate text-xs font-normal text-primary underline-offset-4 hover:underline"
          title={task.title}
        >
          {task.title}
        </Link>
      ))}
    </div>
  );
}

function FilteredEmptyState() {
  const { t } = useTranslation();
  return (
    <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
      {t("statistics:filters.noResults")}
    </div>
  );
}

function formatInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultDateRange() {
  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - 1);
  return {
    startDate: formatInputDate(start),
    endDate: formatInputDate(end),
  };
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
  const inputId = useId();

  return (
    <div className="min-w-40 space-y-1 text-xs text-muted-foreground">
      <label htmlFor={inputId}>{label}</label>
      <Input
        id={inputId}
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
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="min-w-40 space-y-1 text-xs text-muted-foreground">
      <span>{label}</span>
      <Select
        items={Object.fromEntries(
          options.map((option) => [option.value, option.label]),
        )}
        value={value}
        onValueChange={(nextValue) => nextValue && onValueChange(nextValue)}
      >
        <SelectTrigger size="sm" aria-label={label}>
          <SelectValue>
            {options.find((option) => option.value === value)?.label}
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

type MonthlyItem = {
  id: string;
  name: string;
  subtitle?: string;
  overdueTasks: number;
  overdueTaskItems: OverdueTask[];
  months: Array<{
    month: string;
    createdTasks: number;
    completedTasks: number;
  }>;
};

function MonthlyStatisticsSection({
  title,
  description,
  workspaceId,
  items,
  isLoading,
}: {
  title: string;
  description: string;
  workspaceId: string;
  items: MonthlyItem[];
  isLoading: boolean;
}) {
  return (
    <section className="space-y-4 pt-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {isLoading
        ? ["first", "second"].map((key) => (
            <Skeleton key={key} className="h-72 w-full" />
          ))
        : items.map((item) => (
            <div key={item.id} className="rounded-md border p-4">
              <h3 className="text-sm font-medium">{item.name}</h3>
              <OverdueTasks
                count={item.overdueTasks}
                tasks={item.overdueTaskItems}
                workspaceId={workspaceId}
              />
              {item.subtitle ? (
                <p className="mb-4 text-xs text-muted-foreground">
                  {item.subtitle}
                </p>
              ) : (
                <div className="mb-4" />
              )}
              <MonthlyTaskChart points={item.months} />
            </div>
          ))}
      {!isLoading && items.length === 0 ? <FilteredEmptyState /> : null}
    </section>
  );
}
