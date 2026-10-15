import { QueryClient } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vite-plus/test";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { invalidateTaskSupportingAssignees } from "./invalidate-task-supporting-assignees";
import { markBoardCacheChanged } from "./board-cache-version";

const read = vi.hoisted(() => vi.fn());
vi.mock("@/fetchers/task/get-task-supporting-assignees", () => ({
  default: read,
}));

const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
afterEach(() => {
  client.clear();
  read.mockReset();
});

const task: Task = {
  id: "task",
  title: "Task",
  projectId: "project",
  number: 1,
  description: null,
  status: "planned",
  priority: null,
  position: 1,
  startDate: null,
  dueDate: null,
  createdAt: "",
  userId: null,
  assigneeId: null,
  assigneeName: null,
  labels: [{ id: "label", name: "Keep me", color: "red" }],
  supportingAssignees: [{ userId: "former", name: "Former" }],
};
const board: ProjectWithTasks = {
  id: "project",
  name: "Project",
  slug: "PROJ",
  icon: null,
  description: null,
  workspaceId: "workspace",
  isPublic: false,
  columns: [],
  plannedTasks: [task],
  archivedTasks: [],
};

it("patches only the changed task and supports clear-all without fetching board pages", async () => {
  client.setQueryData(["tasks", "project"], board);
  const invalidate = vi.spyOn(client, "invalidateQueries");
  read.mockResolvedValue([]);
  await invalidateTaskSupportingAssignees(client, "project", "task");
  expect(read).toHaveBeenCalledExactlyOnceWith("task");
  expect(
    client.getQueryData<ProjectWithTasks>(["tasks", "project"])?.plannedTasks,
  ).toEqual([{ ...task, supportingAssignees: [] }]);
  expect(invalidate).not.toHaveBeenCalledWith({
    queryKey: ["tasks", "project"],
  });
  invalidate.mockRestore();
});

it("reconciles instead of applying a refresh that races with another task change", async () => {
  client.setQueryData(["tasks", "project"], board);
  let complete!: (value: unknown) => void;
  read.mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const pending = invalidateTaskSupportingAssignees(client, "project", "task");
  await vi.waitFor(() => expect(read).toHaveBeenCalled());
  markBoardCacheChanged(client, "project", "task");
  complete([]);
  await pending;
  expect(client.getQueryState(["tasks", "project"])?.isInvalidated).toBe(true);
  expect(
    client.getQueryData<ProjectWithTasks>(["tasks", "project"])?.plannedTasks[0]
      .supportingAssignees,
  ).toEqual(task.supportingAssignees);
});
