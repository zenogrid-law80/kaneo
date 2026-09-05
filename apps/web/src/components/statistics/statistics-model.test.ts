import { describe, expect, it } from "vitest";
import {
  dateRange,
  selectMembers,
  totalCounts,
  totalMonths,
  validateStatisticsSearch,
} from "./statistics-model";

describe("statistics date filters", () => {
  it("clamps recent-month ranges at the end of shorter months", () => {
    expect(dateRange("recent", new Date(2025, 2, 31))).toEqual({
      startDate: "2025-02-28",
      endDate: "2025-03-31",
    });
    expect(dateRange("recent", new Date(2024, 2, 31))).toEqual({
      startDate: "2024-02-29",
      endDate: "2024-03-31",
    });
  });
  it("handles the previous year for last month", () => {
    expect(dateRange("lastMonth", new Date(2026, 0, 15))).toEqual({
      startDate: "2025-12-01",
      endDate: "2025-12-31",
    });
  });
  it("rejects invalid URL dates and normalizes reversed ranges", () => {
    expect(
      validateStatisticsSearch({
        startDate: "2025-02-29",
        view: "unknown",
        schedule: "bad",
      }),
    ).toMatchObject({
      startDate: undefined,
      view: "overview",
      schedule: "all",
    });
    expect(
      validateStatisticsSearch({
        startDate: "2026-09-05",
        endDate: "2026-08-05",
      }),
    ).toMatchObject({ startDate: "2026-08-05", endDate: "2026-09-05" });
  });
});

describe("statistics aggregation", () => {
  it("intersects team, member and schedule filters without duplicating shared members", () => {
    const members = [
      { userId: "a", overdueTasks: 2 },
      { userId: "b", overdueTasks: 0 },
    ];
    const teams = [
      { teamId: "one", userIds: ["a", "b"] },
      { teamId: "two", userIds: ["a"] },
    ];
    expect(selectMembers(members, teams, { team: "all" })).toEqual(members);
    expect(
      selectMembers(members, teams, { team: "one", schedule: "overdue" }),
    ).toEqual([members[0]]);
    expect(selectMembers(members, teams, { team: "two", member: "b" })).toEqual(
      [],
    );
    expect(selectMembers(members, teams, { team: "none" })).toEqual([]);
    expect(selectMembers(members, teams, { member: "none" })).toEqual([]);
    expect(selectMembers(members, teams, { team: "missing" })).toEqual([]);
    expect(selectMembers(members, teams, { schedule: "onTrack" })).toEqual([
      members[1],
    ]);
  });
  it("weights completion rate by task count rather than averaging member rates", () => {
    expect(
      totalCounts([
        {
          assignedTasks: 1,
          completedTasks: 1,
          inProgressTasks: 0,
          overdueTasks: 0,
        },
        {
          assignedTasks: 9,
          completedTasks: 0,
          inProgressTasks: 9,
          overdueTasks: 3,
        },
      ]),
    ).toEqual({
      assignedTasks: 10,
      completedTasks: 1,
      inProgressTasks: 9,
      overdueTasks: 3,
      completionRate: 10,
    });
    expect(totalCounts([]).completionRate).toBe(0);
  });
  it("combines months across selected members without mutating source points", () => {
    const first = {
      months: [{ month: "2026-09", createdTasks: 3, completedTasks: 1 }],
    };
    expect(
      totalMonths([
        first,
        {
          months: [
            { month: "2026-08", createdTasks: 2, completedTasks: 5 },
            { month: "2026-09", createdTasks: 1, completedTasks: 2 },
          ],
        },
      ]),
    ).toEqual([
      { month: "2026-08", createdTasks: 2, completedTasks: 5 },
      { month: "2026-09", createdTasks: 4, completedTasks: 3 },
    ]);
    expect(first.months[0].createdTasks).toBe(3);
  });
});
