import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import SubtaskRow from "./subtask-row";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { title?: string }) =>
      values?.title ? `${key}: ${values.title}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  },
  useReducedMotion: () => true,
}));
vi.mock(
  "@/components/kanban-board/task-card-context-menu/task-card-context-menu-content",
  () => ({ default: () => null }),
);
vi.mock("./subtask-assignee-popover", () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("./subtask-status-popover", () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));
afterEach(cleanup);

function props(): ComponentProps<typeof SubtaskRow> {
  const task = {
    id: "child",
    title: "Existing task",
    number: 2,
    description: null,
    status: "planned",
    priority: "no-priority",
    startDate: null,
    dueDate: null,
    position: null,
    createdAt: "",
    userId: null,
    assigneeId: null,
    assigneeName: null,
    projectId: "project",
  };
  return {
    task,
    tasks: [task],
    projectId: "project",
    workspaceId: "workspace",
    isSelected: false,
    isFocused: false,
    isCompleted: false,
    canEdit: true,
    selectionRadius: "rounded-md",
    assignee: null,
    onToggleComplete: vi.fn(),
    onNavigate: vi.fn(),
    onDeleteClick: vi.fn(),
    onUnlink: vi.fn(),
    isUnlinking: false,
  };
}

describe("subtask unlink control", () => {
  it("offers a labeled unlink action that does not delete or navigate", () => {
    const values = props();
    render(<SubtaskRow {...values} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "tasks:subtasks.unlink: Existing task",
      }),
    );
    expect(values.onUnlink).toHaveBeenCalledOnce();
    expect(values.onDeleteClick).not.toHaveBeenCalled();
    expect(values.onNavigate).not.toHaveBeenCalled();
  });
  it("disables unlink while the relation is being removed", () => {
    render(<SubtaskRow {...props()} isUnlinking />);
    expect(
      screen.getByRole("button", {
        name: "tasks:subtasks.unlink: Existing task",
      }),
    ).toBeDisabled();
  });
  it("hides unlink without edit permission", () => {
    render(<SubtaskRow {...props()} canEdit={false} />);
    expect(
      screen.queryByRole("button", {
        name: "tasks:subtasks.unlink: Existing task",
      }),
    ).not.toBeInTheDocument();
  });
});
