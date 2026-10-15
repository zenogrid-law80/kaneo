import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { parseISO } from "date-fns";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import type Task from "@/types/task";
import { GanttTaskBar } from "./gantt-task-bar";

const update = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/hooks/mutations/task/use-update-task", () => ({
  useUpdateTask: () => ({ mutateAsync: update }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn() } }));
const days = [
  "2026-08-06",
  "2026-08-07",
  "2026-08-10",
  "2026-08-11",
  "2026-08-12",
  "2026-08-13",
  "2026-08-14",
].map((date) => parseISO(date));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("PointerEvent", MouseEvent);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function show(start = "2026-08-07", end = "2026-08-10") {
  const task = {
    id: "weekend",
    title: "Crossing weekend",
    scheduleStart: parseISO(start),
    scheduleEnd: parseISO(end),
  } as Task & { scheduleStart: Date; scheduleEnd: Date };
  return render(
    <GanttTaskBar
      task={task}
      timeline={{
        days,
        rangeStart: days[0],
        rangeEnd: days[6],
        gridTemplateColumns: "repeat(7, 44px)",
      }}
      pixelsPerDay={44}
      onOpenTask={vi.fn()}
    />,
  );
}
function drag(label: string, pixels: number) {
  fireEvent.pointerDown(screen.getByRole("button", { name: label }), {
    button: 0,
    clientX: 100,
  });
  fireEvent.pointerMove(window, { clientX: 100 + pixels });
  fireEvent.pointerUp(window, { clientX: 100 + pixels });
}

describe("Gantt interactions with weekends hidden", () => {
  it("moves one column from Friday to Monday, preserving actual calendar duration", async () => {
    show();
    drag("tasks:gantt.taskAriaLabel", 44);
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: days[2].toISOString(),
        dueDate: days[5].toISOString(),
      }),
    );
  });
  it("resizes a Friday end directly to Monday", async () => {
    show("2026-08-06", "2026-08-07");
    drag("tasks:gantt.resizeDue", 44);
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: days[0].toISOString(),
        dueDate: days[2].toISOString(),
      }),
    );
  });
  it("disables a hidden endpoint handle while keeping the task movable", async () => {
    show("2026-08-08", "2026-08-10");
    expect(
      screen.getByRole("button", { name: "tasks:gantt.resizeStart" }),
    ).toBeDisabled();
    drag("tasks:gantt.taskAriaLabel", 44);
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: parseISO("2026-08-09").toISOString(),
        dueDate: days[3].toISOString(),
      }),
    );
  });
  it("does not render a bar for a weekend-only task", () => {
    show("2026-08-08", "2026-08-09");
    expect(
      screen.queryByRole("button", { name: "tasks:gantt.taskAriaLabel" }),
    ).not.toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });
});
