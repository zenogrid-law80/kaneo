import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import type getTaskRelations from "@/fetchers/task-relation/get-task-relations";
import { HttpError } from "@/lib/http-error";
import type SubtaskRow from "./subtask-row";
import TaskSubtasks from "./task-subtasks";

const mocks = vi.hoisted(() => ({
  getRelations: vi.fn(),
  search: vi.fn(),
  createRelation: vi.fn(),
  deleteRelation: vi.fn(),
  createTask: vi.fn(),
  deleteTask: vi.fn(),
  canUpdate: vi.fn(),
  canCreate: vi.fn(),
  error: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: unknown }) => children,
}));
vi.mock("@/fetchers/task-relation/get-task-relations", () => ({
  default: mocks.getRelations,
}));
vi.mock("@/fetchers/task-relation/create-task-relation", () => ({
  default: mocks.createRelation,
}));
vi.mock("@/fetchers/task-relation/delete-task-relation", () => ({
  default: mocks.deleteRelation,
}));
vi.mock("@/fetchers/search/global-search", () => ({ default: mocks.search }));
vi.mock("@/hooks/mutations/task/use-create-task", () => ({
  default: () => ({ mutateAsync: mocks.createTask, isPending: false }),
}));
vi.mock("@/hooks/mutations/task/use-delete-task", () => ({
  useDeleteTask: () => ({ mutateAsync: mocks.deleteTask }),
}));
vi.mock("@/hooks/mutations/task/use-update-task-status", () => ({
  useUpdateTaskStatus: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/queries/column/use-get-columns", () => ({
  useGetColumns: () => ({ data: [], isLoading: true }),
}));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "workspace", slug: "workspace" } }),
}));
vi.mock(
  "@/hooks/queries/workspace-users/use-get-active-workspace-users",
  () => ({ useGetActiveWorkspaceUsers: () => ({ data: { members: [] } }) }),
);
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canUpdateTasks: mocks.canUpdate,
    canCreateTasks: mocks.canCreate,
  }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { error: mocks.error, success: vi.fn() },
}));
vi.mock("./subtask-row", () => ({
  default: ({
    task,
    onUnlink,
    isUnlinking,
    canEdit,
  }: ComponentProps<typeof SubtaskRow>) => (
    <div>
      <span>{task.title}</span>
      {canEdit && (
        <button type="button" disabled={isUnlinking} onClick={onUnlink}>
          Unlink {task.title}
        </button>
      )}
    </div>
  ),
}));

type Relations = Awaited<ReturnType<typeof getTaskRelations>>;
let relations: Relations;
let client: QueryClient;
const child = {
  id: "existing-child",
  title: "Existing cross-project task",
  projectId: "child-project",
  number: 7,
  status: "queued",
  isCompleted: false,
  priority: null,
  userId: null,
  assigneeName: null,
};
const relation = {
  id: "subtask-relation",
  sourceTaskId: "parent",
  targetTaskId: child.id,
  relationType: "subtask",
  createdAt: "2026-10-29T00:00:00Z",
  sourceTask: { ...child, id: "parent", projectId: "parent-project" },
  targetTask: child,
};
const result = {
  ...child,
  type: "task",
  projectSlug: "CHILD",
  taskNumber: 7,
  projectName: "Child project",
  relevanceScore: 1,
  createdAt: "2026-10-29T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  relations = [];
  mocks.canUpdate.mockReturnValue(true);
  mocks.canCreate.mockReturnValue(false);
  mocks.getRelations.mockImplementation(async () => [...relations]);
  mocks.search.mockResolvedValue({ results: [result] });
  mocks.createRelation.mockImplementation(async () => {
    relations = [relation];
    return relation;
  });
  mocks.deleteRelation.mockImplementation(async () => {
    relations = [];
    return relation;
  });
});
afterEach(() => {
  cleanup();
  client.clear();
});

function renderSubtasks() {
  return render(
    <QueryClientProvider client={client}>
      <TaskSubtasks
        taskId="parent"
        projectId="parent-project"
        workspaceId="workspace"
        parentStatus="to-do"
      />
    </QueryClientProvider>,
  );
}
async function search(query = "CHILD-7") {
  const trigger = await screen.findByRole("button", {
    name: "tasks:subtasks.linkExisting",
  });
  await waitFor(() => expect(trigger).toBeEnabled());
  fireEvent.click(trigger);
  const input = screen.getByRole("combobox", {
    name: "tasks:relations.searchPlaceholder",
  });
  fireEvent.change(input, { target: { value: query } });
  return input;
}

describe("linking existing subtasks", () => {
  it("links by keyboard without create permission or loaded columns and expands the list", async () => {
    client.setQueryData(["task", "parent"], { id: "parent" });
    client.setQueryData(["tasks", "parent-project"], {
      columns: [{ tasks: [{ id: "parent" }] }],
    });
    client.setQueryData(["task-relations", child.id], []);
    renderSubtasks();
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:subtasks.title" }),
    );
    const input = await search();
    await screen.findByRole("option", { name: /Existing cross-project task/ });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    await screen.findByText(child.title);
    expect(mocks.createRelation).toHaveBeenCalledWith(
      {
        sourceTaskId: "parent",
        targetTaskId: child.id,
        relationType: "subtask",
      },
      expect.anything(),
    );
    expect(mocks.search).toHaveBeenCalledWith({
      q: "CHILD-7",
      type: "tasks",
      workspaceId: "workspace",
      limit: 50,
    });
    expect(mocks.createTask).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("0/1")).toBeVisible();
    expect(client.getQueryState(["task", "parent"])?.isInvalidated).toBe(true);
    expect(
      client.getQueryState(["tasks", "parent-project"])?.isInvalidated,
    ).toBe(true);
    expect(
      client.getQueryState(["task-relations", child.id])?.isInvalidated,
    ).toBe(true);
  });

  it("excludes itself, direct parents, and already-linked children", async () => {
    relations = [
      relation,
      {
        ...relation,
        id: "incoming",
        sourceTaskId: "ancestor",
        targetTaskId: "parent",
      },
    ];
    mocks.search.mockResolvedValue({
      results: [
        result,
        { ...result, id: "parent", title: "Self" },
        { ...result, id: "ancestor", title: "Direct parent" },
        { ...result, id: "available", title: "Available task" },
      ],
    });
    renderSubtasks();
    await search();
    await screen.findByRole("option", { name: /Available task/ });
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });

  it("keeps the search open and explains a rejected circular hierarchy", async () => {
    mocks.createRelation.mockRejectedValue(
      new HttpError(400, "Cannot create a circular subtask hierarchy"),
    );
    renderSubtasks();
    await search();
    fireEvent.click(
      await screen.findByRole("option", {
        name: /Existing cross-project task/,
      }),
    );
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(
        "tasks:subtasks.invalidHierarchy",
      ),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mocks.createTask).not.toHaveBeenCalled();
  });

  it("unlinks a child without deleting its task and refreshes both relation caches", async () => {
    relations = [relation];
    client.setQueryData(["task-relations", child.id], [relation]);
    renderSubtasks();
    fireEvent.click(
      await screen.findByRole("button", { name: `Unlink ${child.title}` }),
    );
    await screen.findByText("tasks:subtasks.empty");
    expect(mocks.deleteRelation).toHaveBeenCalledWith(
      relation.id,
      expect.anything(),
    );
    expect(mocks.deleteTask).not.toHaveBeenCalled();
    expect(screen.queryByText(child.title)).not.toBeInTheDocument();
    expect(
      client.getQueryState(["task-relations", child.id])?.isInvalidated,
    ).toBe(true);
  });

  it("keeps the child visible when unlinking fails", async () => {
    relations = [relation];
    mocks.deleteRelation.mockRejectedValue(new Error("Unavailable"));
    renderSubtasks();
    fireEvent.click(
      await screen.findByRole("button", { name: `Unlink ${child.title}` }),
    );
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith("tasks:subtasks.unlinkError"),
    );
    expect(screen.getByText(child.title)).toBeVisible();
    expect(mocks.deleteTask).not.toHaveBeenCalled();
  });

  it("hides linking and unlinking without task update permission", async () => {
    relations = [relation];
    mocks.canUpdate.mockReturnValue(false);
    renderSubtasks();
    await screen.findByText(child.title);
    expect(
      screen.queryByRole("button", { name: "tasks:subtasks.linkExisting" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: `Unlink ${child.title}` }),
    ).not.toBeInTheDocument();
  });

  it("shows a subtask-specific empty state when there are no matches", async () => {
    mocks.search.mockResolvedValue({ results: [] });
    renderSubtasks();
    await search("No match");
    await screen.findByText("tasks:subtasks.noTasksToLink");
    expect(mocks.createRelation).not.toHaveBeenCalled();
  });
});
