import { describe, expect, it } from "vitest";
import { getMyTaskDueGroup } from "./my-task-due-group";

describe("my task due groups", () => {
  it("uses local calendar days, including already elapsed times today", () => {
    const now = new Date(2026, 8, 5, 16);
    expect(
      getMyTaskDueGroup(new Date(2026, 8, 4, 23, 59).toISOString(), now),
    ).toBe("overdue");
    expect(getMyTaskDueGroup(new Date(2026, 8, 5, 0).toISOString(), now)).toBe(
      "today",
    );
    expect(getMyTaskDueGroup(new Date(2026, 8, 6, 0).toISOString(), now)).toBe(
      "upcoming",
    );
    expect(getMyTaskDueGroup(null, now)).toBe("undated");
  });
});
