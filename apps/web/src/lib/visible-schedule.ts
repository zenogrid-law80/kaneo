import { differenceInCalendarDays, isWeekend, startOfDay } from "date-fns";

type Schedule = { scheduleStart: Date; scheduleEnd: Date };

/** Project actual dates onto displayed columns without changing the schedule. */
export function visibleScheduleColumns(days: Date[], start: Date, end: Date) {
  const first = days.findIndex(
    (day) => differenceInCalendarDays(day, start) >= 0,
  );
  let last = days.length - 1;
  while (last >= 0 && differenceInCalendarDays(days[last], end) > 0) last--;
  return { first, last, visible: first >= 0 && first <= last };
}

export function countHiddenWeekendTasks(
  tasks: Schedule[],
  rangeStart: Date,
  rangeEnd: Date,
) {
  return tasks.filter(({ scheduleStart, scheduleEnd }) => {
    const start = startOfDay(
      new Date(Math.max(scheduleStart.getTime(), rangeStart.getTime())),
    );
    const end = startOfDay(
      new Date(Math.min(scheduleEnd.getTime(), rangeEnd.getTime())),
    );
    const span = differenceInCalendarDays(end, start);
    return span >= 0 && span <= 1 && isWeekend(start) && isWeekend(end);
  }).length;
}
