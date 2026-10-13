import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vite-plus/test";
import {
  invalidateMilestones,
  invalidateMilestoneTasks,
} from "./milestone-cache";

describe("milestone cache", () => {
  it("invalidates every page and detail in one project without affecting another", () => {
    const client = new QueryClient();
    const affected = [
      ["milestones", "p1", { page: 2 }],
      ["milestone", "p1", "m1"],
      ["milestone-tasks", "p1", "m1", { page: 3 }],
    ];
    for (const key of affected) client.setQueryData(key, { value: 1 });
    client.setQueryData(["milestones", "p2"], { value: 2 });
    invalidateMilestones(client, "p1");
    for (const key of affected)
      expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    expect(client.getQueryState(["milestones", "p2"])?.isInvalidated).toBe(
      false,
    );
  });
  it("refreshes task details, boards, activities and candidates after deletion or bulk detach", () => {
    const client = new QueryClient();
    const keys = [
      ["task", "t1"],
      ["tasks", "p1"],
      ["activities", "t1"],
      ["my-tasks"],
      ["milestone-candidates", "p1", "", 1],
      [
        "workspace-member-statistics",
        "w1",
        "p1",
        "2026-10-01",
        "2026-10-31",
        "m1",
      ],
      [
        "member-team-monthly-statistics",
        "w1",
        "p1",
        "2026-10-01",
        "2026-10-31",
        "none",
      ],
    ];
    for (const key of keys) client.setQueryData(key, {});
    const otherProject = ["workspace-member-statistics", "w1", "p2"];
    client.setQueryData(otherProject, {});
    invalidateMilestoneTasks(client, "p1");
    for (const key of keys)
      expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    expect(client.getQueryState(otherProject)?.isInvalidated).toBe(false);
  });
});
