import { differenceInCalendarDays, startOfDay } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { visibleScheduleColumns } from "@/lib/visible-schedule";
import { moveGanttDates } from "./move-dates";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

const CLICK_MOVE_THRESHOLD_PX = 4;
const MOBILE_MOVE_THRESHOLD_PX = 14;

type ScheduledTask = Task & {
  scheduleStart: Date;
  scheduleEnd: Date;
};

type GanttTaskBarProps = {
  task: ScheduledTask;
  timeline: {
    days: Date[];
    rangeStart: Date;
    rangeEnd?: Date;
    gridTemplateColumns: string;
  };
  pixelsPerDay: number;
  isMobile?: boolean;
  onOpenTask: () => void;
};

function toIsoDay(d: Date) {
  return startOfDay(d).toISOString();
}

export function GanttTaskBar({
  task,
  timeline,
  pixelsPerDay,
  isMobile = false,
  onOpenTask,
}: GanttTaskBarProps) {
  const { t } = useTranslation();
  const { mutateAsync: updateTask } = useUpdateTask();
  const [dragDisplay, setDragDisplay] = useState<{
    start: Date;
    end: Date;
  } | null>(null);

  // Drop the drag overlay once server data matches
  useEffect(() => {
    if (!dragDisplay) return;
    const startMatches =
      differenceInCalendarDays(task.scheduleStart, dragDisplay.start) === 0;
    const endMatches =
      differenceInCalendarDays(task.scheduleEnd, dragDisplay.end) === 0;
    if (startMatches && endMatches) {
      setDragDisplay(null);
    }
  }, [dragDisplay, task.scheduleEnd, task.scheduleStart]);

  const displayStart = dragDisplay?.start ?? task.scheduleStart;
  const displayEnd = dragDisplay?.end ?? task.scheduleEnd;

  const trackCount = timeline.days.length;
  const {
    visible: barInView,
    first,
    last,
  } = visibleScheduleColumns(timeline.days, displayStart, displayEnd);
  const lineStart = first + 1;
  const lineEnd = last + 2;
  const startIndex = timeline.days.findIndex(
    (day) => differenceInCalendarDays(day, task.scheduleStart) === 0,
  );
  const endIndex = timeline.days.findIndex(
    (day) => differenceInCalendarDays(day, task.scheduleEnd) === 0,
  );
  const startIsVisible = startIndex >= 0;
  const endIsVisible = endIndex >= 0;

  const persistDates = useCallback(
    async (nextStart: Date, nextEnd: Date): Promise<boolean> => {
      try {
        await updateTask({
          ...task,
          startDate: toIsoDay(nextStart),
          dueDate: toIsoDay(nextEnd),
        });
        return true;
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("tasks:gantt.updateDatesError"),
        );
        return false;
      }
    },
    [task, updateTask, t],
  );

  const pxPerDay = Math.max(pixelsPerDay, 1e-6);
  const moveThresholdPx = isMobile
    ? MOBILE_MOVE_THRESHOLD_PX
    : CLICK_MOVE_THRESHOLD_PX;

  const handleResizeLeftPointerDown = (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const originX = event.clientX;
    const initialStart = task.scheduleStart;
    const initialEnd = task.scheduleEnd;
    const { first: startIdx, last: endIdx } = visibleScheduleColumns(
      timeline.days,
      initialStart,
      initialEnd,
    );

    const onMove = (ev: PointerEvent) => {
      const deltaDays = Math.round((ev.clientX - originX) / pxPerDay);
      let nextStartIdx = startIdx + deltaDays;
      nextStartIdx = Math.max(0, Math.min(nextStartIdx, endIdx));
      const nextStart =
        deltaDays === 0
          ? initialStart
          : (timeline.days[nextStartIdx] ?? initialStart);
      const nextEnd = initialEnd;
      setDragDisplay({ start: nextStart, end: nextEnd });
    };

    const onUp = async (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      if (ev.type === "pointercancel") {
        setDragDisplay(null);
        return;
      }
      const deltaDays = Math.round((ev.clientX - originX) / pxPerDay);
      let nextStartIdx = startIdx + deltaDays;
      nextStartIdx = Math.max(0, Math.min(nextStartIdx, endIdx));
      const nextStart =
        deltaDays === 0
          ? initialStart
          : (timeline.days[nextStartIdx] ?? initialStart);
      if (nextStart.getTime() === initialStart.getTime()) {
        setDragDisplay(null);
        return;
      }
      const ok = await persistDates(nextStart, initialEnd);
      if (!ok) {
        setDragDisplay(null);
      }
    };

    const onCancel = onUp;

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  };

  const handleResizeRightPointerDown = (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const originX = event.clientX;
    const initialStart = task.scheduleStart;
    const initialEnd = task.scheduleEnd;
    const { first: startIdx, last: endIdx } = visibleScheduleColumns(
      timeline.days,
      initialStart,
      initialEnd,
    );

    const onMove = (ev: PointerEvent) => {
      const deltaDays = Math.round((ev.clientX - originX) / pxPerDay);
      let nextEndIdx = endIdx + deltaDays;
      nextEndIdx = Math.max(startIdx, Math.min(nextEndIdx, trackCount - 1));
      const nextEnd =
        deltaDays === 0
          ? initialEnd
          : (timeline.days[nextEndIdx] ?? initialEnd);
      const nextStart = initialStart;
      setDragDisplay({ start: nextStart, end: nextEnd });
    };

    const onUp = async (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      if (ev.type === "pointercancel") {
        setDragDisplay(null);
        return;
      }
      const deltaDays = Math.round((ev.clientX - originX) / pxPerDay);
      let nextEndIdx = endIdx + deltaDays;
      nextEndIdx = Math.max(startIdx, Math.min(nextEndIdx, trackCount - 1));
      const nextEnd =
        deltaDays === 0
          ? initialEnd
          : (timeline.days[nextEndIdx] ?? initialEnd);
      if (nextEnd.getTime() === initialEnd.getTime()) {
        setDragDisplay(null);
        return;
      }
      const ok = await persistDates(initialStart, nextEnd);
      if (!ok) {
        setDragDisplay(null);
      }
    };

    const onCancel = onUp;

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  };

  const handleMovePointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const originX = event.clientX;
    const initialStart = task.scheduleStart;
    const initialEnd = task.scheduleEnd;
    if (
      differenceInCalendarDays(initialStart, timeline.rangeStart) < 0 ||
      differenceInCalendarDays(
        initialEnd,
        timeline.rangeEnd ?? timeline.days[trackCount - 1],
      ) > 0
    ) {
      onOpenTask();
      return;
    }
    const datesAt = (clientX: number) =>
      moveGanttDates(
        timeline.days,
        initialStart,
        initialEnd,
        Math.round((clientX - originX) / pxPerDay),
        timeline.rangeEnd ?? timeline.days[trackCount - 1],
        timeline.rangeStart,
      );

    const onMove = (ev: PointerEvent) => {
      setDragDisplay(datesAt(ev.clientX));
    };

    const onUp = async (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      if (ev.type === "pointercancel") {
        setDragDisplay(null);
        return;
      }
      const moved = Math.abs(ev.clientX - originX);
      const { start: nextStart, end: nextEnd } = datesAt(ev.clientX);

      if (moved < moveThresholdPx) {
        setDragDisplay(null);
        onOpenTask();
        return;
      }
      if (
        nextStart.getTime() === initialStart.getTime() &&
        nextEnd.getTime() === initialEnd.getTime()
      ) {
        setDragDisplay(null);
        return;
      }
      const ok = await persistDates(nextStart, nextEnd);
      if (!ok) {
        setDragDisplay(null);
      }
    };

    const onCancel = onUp;

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  };

  if (!barInView || lineEnd <= lineStart) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] grid items-center"
      style={{
        gridTemplateColumns: timeline.gridTemplateColumns,
      }}
    >
      <div
        style={{ gridColumn: `${lineStart} / ${lineEnd}` }}
        className="group pointer-events-auto relative mx-1 flex min-h-[44px] min-w-0 items-stretch overflow-hidden rounded-md border border-primary/25 bg-background text-left text-sm font-medium leading-none text-foreground shadow-sm transition-colors hover:border-primary/40 sm:h-11 sm:min-h-0"
      >
        <button
          type="button"
          aria-label={t("tasks:gantt.resizeStart")}
          disabled={!startIsVisible}
          onPointerDown={handleResizeLeftPointerDown}
          className={cn(
            "relative z-20 shrink-0 cursor-ew-resize touch-none border-r border-primary/15 bg-primary/8 hover:bg-primary/18",
            "min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:w-2",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          )}
        />
        <button
          type="button"
          aria-label={t("tasks:gantt.taskAriaLabel", { title: task.title })}
          className="relative z-10 min-h-[44px] min-w-0 flex-1 cursor-grab touch-manipulation overflow-hidden px-2 text-left active:cursor-grabbing sm:min-h-0 sm:px-2.5"
          onPointerDown={handleMovePointerDown}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpenTask();
            }
          }}
        >
          <div className="absolute inset-0 z-0 bg-primary/12 transition-colors group-hover:bg-primary/18" />
          <span className="relative z-10 block truncate">{task.title}</span>
        </button>
        <button
          type="button"
          aria-label={t("tasks:gantt.resizeDue")}
          disabled={!endIsVisible}
          onPointerDown={handleResizeRightPointerDown}
          className={cn(
            "relative z-20 shrink-0 cursor-ew-resize touch-none border-l border-primary/15 bg-primary/8 hover:bg-primary/18",
            "min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:w-2",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          )}
        />
      </div>
    </div>
  );
}
