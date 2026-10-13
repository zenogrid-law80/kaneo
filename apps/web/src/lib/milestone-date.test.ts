import { describe, expect, it } from "vite-plus/test";
import { isMilestoneOverdue, localDateString } from "./milestone-date";

describe("milestone dates", () => {
  it("keeps calendar dates in the user's timezone", () => {
    expect(localDateString(new Date(2026, 9, 13, 0, 1))).toBe("2026-10-13");
    expect(localDateString(new Date(2026, 9, 13, 23, 59))).toBe("2026-10-13");
  });
  it("is overdue only after the target day while open", () => {
    expect(
      isMilestoneOverdue(
        { status: "open", dueDate: "2026-10-13" },
        "2026-10-13",
      ),
    ).toBe(false);
    expect(
      isMilestoneOverdue(
        { status: "open", dueDate: "2026-10-13" },
        "2026-10-14",
      ),
    ).toBe(true);
    expect(
      isMilestoneOverdue(
        { status: "closed", dueDate: "2026-10-13" },
        "2026-10-14",
      ),
    ).toBe(false);
    expect(
      isMilestoneOverdue({ status: "open", dueDate: null }, "2026-10-14"),
    ).toBe(false);
  });
});
