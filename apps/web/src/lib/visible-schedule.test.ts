import { parseISO } from "date-fns";
import { describe, expect, it } from "vite-plus/test";
import {
  countHiddenWeekendTasks,
  visibleScheduleColumns,
} from "./visible-schedule";
const day = parseISO;
const span = (start: string, end = start) => ({
  scheduleStart: day(start),
  scheduleEnd: day(end),
});

describe("visible schedule projection", () => {
  const days = ["2026-08-07", "2026-08-10", "2026-08-11"].map((value) =>
    day(value),
  );
  it("compresses a weekend-crossing task into adjacent columns", () => {
    expect(
      visibleScheduleColumns(days, day("2026-08-07"), day("2026-08-10")),
    ).toEqual({ first: 0, last: 1, visible: true });
    expect(
      visibleScheduleColumns(days, day("2026-08-08"), day("2026-08-10")),
    ).toEqual({ first: 1, last: 1, visible: true });
  });
  it("omits tasks with no displayed date", () => {
    expect(
      visibleScheduleColumns(days, day("2026-08-08"), day("2026-08-09"))
        .visible,
    ).toBe(false);
    expect(
      visibleScheduleColumns(days, day("2026-08-12"), day("2026-08-13"))
        .visible,
    ).toBe(false);
  });
  it("counts only weekend-only schedules inside the current period, including clipped intervals", () => {
    const tasks = [
      span("2026-08-08", "2026-08-09"),
      span("2026-08-09"),
      span("2026-08-07", "2026-08-10"),
      span("2026-08-15", "2026-08-16"),
    ];
    expect(
      countHiddenWeekendTasks(tasks, day("2026-08-01"), day("2026-08-14")),
    ).toBe(2);
    expect(
      countHiddenWeekendTasks(
        [span("2026-08-07", "2026-08-10")],
        day("2026-08-08"),
        day("2026-08-09"),
      ),
    ).toBe(1);
  });
});
