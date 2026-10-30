import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import type { DndContextProps, DragEndEvent } from "@dnd-kit/core";
import BugBoard from "./bug-board";

const mocks = vi.hoisted(() => ({ move: vi.fn(), dnd: {} as DndContextProps }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/mutations/bug/use-bug-mutations", () => ({
  useBugMutations: () => ({
    update: { mutateAsync: mocks.move, isPending: false },
  }),
}));
vi.mock("./bug-column", () => ({
  default: ({ status, disabled }: { status: string; disabled: boolean }) => (
    <div data-testid={status} data-disabled={disabled} />
  ),
}));
vi.mock("@dnd-kit/core", () => ({
  DndContext: (props: DndContextProps) => {
    mocks.dnd = props;
    return props.children;
  },
  DragOverlay: () => null,
  MouseSensor: {},
  TouchSensor: {},
  KeyboardSensor: {},
  useSensor: vi.fn(),
  useSensors: vi.fn(),
  pointerWithin: vi.fn(),
  rectIntersection: vi.fn(),
}));
afterEach(cleanup);
beforeEach(() => {
  mocks.move.mockReset();
});
const active = {
  id: "bug",
  rect: { current: { initial: null, translated: null } },
  data: {
    current: { bug: { id: "bug", title: "Dragged bug", status: "new" } },
  },
};
function dragEvent(status: string | null): DragEndEvent {
  return {
    active,
    activatorEvent: new MouseEvent("mousedown"),
    collisions: [],
    delta: { x: 0, y: 0 },
    over: status
      ? {
          id: status,
          disabled: false,
          data: { current: {} },
          rect: {
            left: 0,
            top: 0,
            right: 100,
            bottom: 100,
            width: 100,
            height: 100,
          },
        }
      : null,
  };
}
function start() {
  act(() => mocks.dnd.onDragStart?.(dragEvent(null)));
}
async function drop(status: string | null) {
  await act(async () => {
    await mocks.dnd.onDragEnd?.(dragEvent(status));
  });
}
it("moves only the dropped bug to another stage and ignores same-stage, outside and cancelled drops", async () => {
  mocks.move.mockResolvedValue({});
  render(
    <BugBoard
      projectId="project"
      filters={{ fixerId: "member" }}
      canMove
      onSelect={vi.fn()}
    />,
  );
  start();
  await drop("in-progress");
  expect(mocks.move).toHaveBeenCalledWith({
    id: "bug",
    input: { status: "in-progress" },
  });
  start();
  await drop("new");
  start();
  await drop(null);
  start();
  act(() => mocks.dnd.onDragCancel?.(dragEvent(null)));
  await drop("resolved");
  expect(mocks.move).toHaveBeenCalledTimes(1);
});
it("surfaces failed moves and disables dragging without update permission", async () => {
  mocks.move.mockRejectedValue(new Error("Offline"));
  const view = render(
    <BugBoard projectId="project" filters={{}} canMove onSelect={vi.fn()} />,
  );
  start();
  await drop("resolved");
  expect(screen.getByRole("alert")).toHaveTextContent("tasks:bugs.moveError");
  mocks.move.mockClear();
  view.rerender(
    <BugBoard
      projectId="project"
      filters={{}}
      canMove={false}
      onSelect={vi.fn()}
    />,
  );
  expect(screen.getByTestId("new")).toHaveAttribute("data-disabled", "true");
  start();
  await drop("resolved");
  expect(mocks.move).not.toHaveBeenCalled();
});
