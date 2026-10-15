import { differenceInCalendarDays, parseISO } from "date-fns";
import { describe, expect, it } from "vite-plus/test";
import { moveGanttDates } from "./move-dates";
const days = [
  "2026-08-06",
  "2026-08-07",
  "2026-08-10",
  "2026-08-11",
  "2026-08-12",
  "2026-08-13",
  "2026-08-14",
].map((date) => parseISO(date));

describe("moving across hidden weekends", () => {
  it("moves Friday to Monday in one column step and preserves calendar duration", () => {
    const result = moveGanttDates(
      days,
      parseISO("2026-08-07"),
      parseISO("2026-08-10"),
      1,
      days[6],
    );
    expect(result.start).toEqual(parseISO("2026-08-10"));
    expect(result.end).toEqual(parseISO("2026-08-13"));
    expect(differenceInCalendarDays(result.end, result.start)).toBe(3);
  });
  it("clamps to a valid start using actual dates rather than visible column count", () => {
    const result = moveGanttDates(
      days,
      parseISO("2026-08-07"),
      parseISO("2026-08-10"),
      100,
      days[6],
    );
    expect(result.start).toEqual(parseISO("2026-08-11"));
    expect(result.end).toEqual(parseISO("2026-08-14"));
  });
  it("allows moving a schedule with a hidden weekend endpoint without shortening it", () => {
    const result = moveGanttDates(
      days,
      parseISO("2026-08-08"),
      parseISO("2026-08-10"),
      1,
      days[6],
    );
    expect(result.start).toEqual(parseISO("2026-08-09"));
    expect(result.end).toEqual(parseISO("2026-08-11"));
  });
  it("keeps exact original dates on a click with no drag", () => {
    const start = parseISO("2026-08-07T12:00:00");
    const end = parseISO("2026-08-10T12:00:00");
    expect(moveGanttDates(days, start, end, 0, days[6])).toEqual({
      start,
      end,
    });
  });
});
