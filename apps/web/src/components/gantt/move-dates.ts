import { addDays, differenceInCalendarDays } from "date-fns";
import { visibleScheduleColumns } from "@/lib/visible-schedule";

/** A column step can cross a hidden weekend; preserve the calendar duration. */
export function moveGanttDates(
  days: Date[],
  start: Date,
  end: Date,
  deltaColumns: number,
  rangeEnd: Date,
  rangeStart: Date = days[0],
) {
  const { first, visible } = visibleScheduleColumns(days, start, end);
  if (!visible || deltaColumns === 0) return { start, end };
  const datesAt = (index: number) => {
    const delta = differenceInCalendarDays(days[index], days[first]);
    return { start: addDays(start, delta), end: addDays(end, delta) };
  };
  let minimumIndex = 0;
  let maximumIndex = days.length - 1;
  while (
    minimumIndex <= maximumIndex &&
    differenceInCalendarDays(datesAt(minimumIndex).start, rangeStart) < 0
  )
    minimumIndex++;
  while (
    maximumIndex >= minimumIndex &&
    differenceInCalendarDays(datesAt(maximumIndex).end, rangeEnd) > 0
  )
    maximumIndex--;
  if (maximumIndex < minimumIndex) return { start, end };
  return datesAt(
    Math.max(minimumIndex, Math.min(first + deltaColumns, maximumIndex)),
  );
}
