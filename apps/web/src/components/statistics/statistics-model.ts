export type StatisticsSearch = {
  startDate?: string;
  endDate?: string;
  member?: string;
  team?: string;
  schedule?: "all" | "overdue" | "onTrack";
  view?: "overview" | "members" | "teams";
};

export function inputDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function dateRange(preset = "recent", now = new Date()) {
  const end = new Date(now);
  const start = new Date(now);
  if (preset === "thisMonth") start.setDate(1);
  else if (preset === "lastMonth") {
    start.setDate(1);
    start.setMonth(start.getMonth() - 1);
    end.setDate(0);
  } else {
    // Clamp the day when the previous month is shorter (e.g. March 31).
    start.setDate(1);
    start.setMonth(start.getMonth() - 1);
    const lastDay = new Date(
      start.getFullYear(),
      start.getMonth() + 1,
      0,
    ).getDate();
    start.setDate(Math.min(now.getDate(), lastDay));
  }
  return { startDate: inputDate(start), endDate: inputDate(end) };
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const parsed = new Date(`${value}T12:00:00`);
  return !Number.isNaN(parsed.getTime()) && inputDate(parsed) === value;
}

export function validateStatisticsSearch(
  search: Record<string, unknown>,
): StatisticsSearch {
  let startDate = validDate(search.startDate) ? search.startDate : undefined;
  let endDate = validDate(search.endDate) ? search.endDate : undefined;
  if (startDate && endDate && startDate > endDate)
    [startDate, endDate] = [endDate, startDate];
  return {
    startDate,
    endDate,
    member: typeof search.member === "string" ? search.member : undefined,
    team: typeof search.team === "string" ? search.team : undefined,
    schedule:
      search.schedule === "overdue" || search.schedule === "onTrack"
        ? search.schedule
        : "all",
    view:
      search.view === "members" || search.view === "teams"
        ? search.view
        : "overview",
  };
}

export type Counts = {
  assignedTasks: number;
  completedTasks: number;
  overdueTasks: number;
  inProgressTasks: number;
};

export function selectMembers<
  T extends { userId: string; overdueTasks: number },
>(
  members: T[],
  teams: { teamId: string; userIds: string[] }[],
  filters: Pick<StatisticsSearch, "member" | "team" | "schedule">,
) {
  const team = filters.team ?? "all";
  const member = filters.member ?? "all";
  const selectedTeam = teams.find((item) => item.teamId === team);
  const teamIds = new Set(selectedTeam?.userIds);
  return members.filter(
    (item) =>
      (team === "all" || teamIds.has(item.userId)) &&
      (member === "all" || member === item.userId) &&
      (filters.schedule === "overdue"
        ? item.overdueTasks > 0
        : filters.schedule === "onTrack"
          ? item.overdueTasks === 0
          : true),
  );
}

export function totalCounts(rows: Counts[]) {
  const totals = rows.reduce(
    (total, row) => ({
      assignedTasks: total.assignedTasks + row.assignedTasks,
      completedTasks: total.completedTasks + row.completedTasks,
      overdueTasks: total.overdueTasks + row.overdueTasks,
      inProgressTasks: total.inProgressTasks + row.inProgressTasks,
    }),
    {
      assignedTasks: 0,
      completedTasks: 0,
      overdueTasks: 0,
      inProgressTasks: 0,
    },
  );
  return {
    ...totals,
    completionRate: totals.assignedTasks
      ? Math.round((totals.completedTasks / totals.assignedTasks) * 100)
      : 0,
  };
}

export type Month = {
  month: string;
  createdTasks: number;
  completedTasks: number;
};

export function totalMonths(rows: { months: Month[] }[]) {
  const months = new Map<string, Month>();
  for (const row of rows)
    for (const point of row.months) {
      const total = months.get(point.month) ?? {
        month: point.month,
        createdTasks: 0,
        completedTasks: 0,
      };
      total.createdTasks += point.createdTasks;
      total.completedTasks += point.completedTasks;
      months.set(point.month, total);
    }
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
}
