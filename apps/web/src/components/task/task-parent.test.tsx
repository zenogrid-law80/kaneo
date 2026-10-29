import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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
import TaskParent from "./task-parent";

const mocks = vi.hoisted(() => ({
  relations: vi.fn(),
  search: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
  navigate: vi.fn(),
  canEdit: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { title?: string }) =>
      values?.title ? `${key}: ${values.title}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canUpdateTasks: mocks.canEdit }),
}));
vi.mock("@/fetchers/task-relation/get-task-relations", () => ({
  default: mocks.relations,
}));
vi.mock("@/fetchers/task-relation/create-task-relation", () => ({
  default: mocks.create,
}));
vi.mock("@/fetchers/task-relation/delete-task-relation", () => ({
  default: mocks.remove,
}));
vi.mock("@/fetchers/search/global-search", () => ({ default: mocks.search }));
vi.mock("@/lib/toast", () => ({
  toast: { error: mocks.error, success: mocks.success },
}));

type Relations = Awaited<ReturnType<typeof getTaskRelations>>;
let relations: Relations;
let client: QueryClient;
const parent = {
  id: "later-parent",
  title: "Later parent",
  projectId: "parent-project",
  number: 2,
  status: "todo",
  isCompleted: false,
  priority: null,
  userId: null,
  assigneeName: null,
};
const parentRelation = {
  id: "relation",
  sourceTaskId: parent.id,
  targetTaskId: "child",
  relationType: "subtask",
  createdAt: "2026-10-29T00:00:00Z",
  sourceTask: parent,
  targetTask: { ...parent, id: "child", projectId: "child-project" },
};
const searchItem = {
  ...parent,
  type: "task",
  projectSlug: "PAR",
  taskNumber: 2,
  projectName: "Parent project",
  createdAt: "2026-10-29T00:00:00Z",
  relevanceScore: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  relations = [];
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  mocks.canEdit.mockReturnValue(true);
  mocks.relations.mockImplementation(async () => [...relations]);
  mocks.search.mockResolvedValue({ results: [searchItem] });
  mocks.create.mockImplementation(async () => {
    relations = [parentRelation];
    return parentRelation;
  });
  mocks.remove.mockImplementation(async () => {
    relations = [];
    return parentRelation;
  });
});
afterEach(() => {
  cleanup();
  client.clear();
});

function renderParent() {
  return render(
    <QueryClientProvider client={client}>
      <TaskParent taskId="child" workspaceId="workspace" />
    </QueryClientProvider>,
  );
}
async function openSearch(query = "PAR-2") {
  fireEvent.click(
    await screen.findByRole("button", { name: "tasks:parent.assign" }),
  );
  const input = screen.getByRole("combobox", {
    name: "tasks:parent.searchPlaceholder",
  });
  fireEvent.change(input, { target: { value: query } });
  return input;
}

describe("parent task assignment", () => {
  it("searches the workspace by task ID, assigns an existing parent with the keyboard, and opens its project", async () => {
    client.setQueryData(["task", parent.id], parent);
    client.setQueryData(["tasks", "parent-project"], {
      columns: [{ tasks: [parent] }],
    });
    renderParent();
    const input = await openSearch();
    await screen.findByRole("option", { name: /Later parent/ });
    expect(mocks.search).toHaveBeenCalledWith({
      q: "PAR-2",
      type: "tasks",
      workspaceId: "workspace",
      limit: 50,
    });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        {
          sourceTaskId: parent.id,
          targetTaskId: "child",
          relationType: "subtask",
        },
        expect.anything(),
      ),
    );
    const link = await screen.findByRole("button", {
      name: /tasks:detail.subtaskOf Later parent/,
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(client.getQueryState(["task", parent.id])?.isInvalidated).toBe(true);
    expect(
      client.getQueryState(["tasks", "parent-project"])?.isInvalidated,
    ).toBe(true);
    fireEvent.click(link);
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        params: {
          workspaceId: "workspace",
          projectId: "parent-project",
          taskId: parent.id,
        },
      }),
    );
  });

  it("excludes itself and direct children from search results", async () => {
    relations = [
      { ...parentRelation, sourceTaskId: "child", targetTaskId: "grandchild" },
    ];
    mocks.search.mockResolvedValue({
      results: [
        searchItem,
        { ...searchItem, id: "child", title: "Self" },
        { ...searchItem, id: "grandchild", title: "Direct child" },
      ],
    });
    renderParent();
    await openSearch();
    await screen.findByRole("option", { name: /Later parent/ });
    expect(
      screen.queryByRole("option", { name: /Self|Direct child/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps assignment disabled until the saved parent has refreshed", async () => {
    let finishRefresh: (value: Relations) => void = () => {};
    mocks.create.mockImplementation(async () => {
      mocks.relations.mockReturnValue(
        new Promise<Relations>((resolve) => {
          finishRefresh = resolve;
        }),
      );
      return parentRelation;
    });
    renderParent();
    const input = await openSearch();
    fireEvent.click(
      await screen.findByRole("option", { name: /Later parent/ }),
    );
    await waitFor(() => expect(input).toBeDisabled());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    finishRefresh([parentRelation]);
    await screen.findByRole("button", {
      name: /tasks:detail.subtaskOf Later parent/,
    });
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it("keeps the search open and explains a rejected circular hierarchy", async () => {
    mocks.create.mockRejectedValue(
      new HttpError(400, "Cannot create a circular subtask hierarchy"),
    );
    renderParent();
    await openSearch();
    fireEvent.click(
      await screen.findByRole("option", { name: /Later parent/ }),
    );
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith("tasks:parent.invalidHierarchy"),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("removes the parent and refreshes both task relation caches", async () => {
    relations = [parentRelation];
    client.setQueryData(["task-relations", parent.id], [parentRelation]);
    renderParent();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "tasks:parent.remove: Later parent",
      }),
    );
    await screen.findByRole("button", { name: "tasks:parent.assign" });
    expect(mocks.remove).toHaveBeenCalledWith("relation", expect.anything());
    expect(
      client.getQueryState(["task-relations", parent.id])?.isInvalidated,
    ).toBe(true);
    expect(
      screen.queryByRole("button", { name: /tasks:detail.subtaskOf/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps the existing parent when unlinking fails", async () => {
    relations = [parentRelation];
    mocks.remove.mockRejectedValue(new Error("Unavailable"));
    renderParent();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "tasks:parent.remove: Later parent",
      }),
    );
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith("tasks:parent.removeError"),
    );
    expect(
      screen.getByRole("button", {
        name: /tasks:detail.subtaskOf Later parent/,
      }),
    ).toBeInTheDocument();
  });

  it("offers no editing controls without update permission", async () => {
    mocks.canEdit.mockReturnValue(false);
    relations = [parentRelation];
    renderParent();
    await screen.findByRole("button", {
      name: /tasks:detail.subtaskOf Later parent/,
    });
    expect(
      screen.queryByRole("button", {
        name: /tasks:parent.assign|tasks:parent.remove/,
      }),
    ).not.toBeInTheDocument();
  });

  it("shows an empty result and retries a failed remote search", async () => {
    mocks.search.mockRejectedValueOnce(new Error("Search unavailable"));
    mocks.search.mockResolvedValue({ results: [] });
    renderParent();
    await openSearch("No match");
    await screen.findByText("tasks:parent.searchError");
    fireEvent.click(screen.getByRole("button", { name: "tasks:parent.retry" }));
    await screen.findByText("tasks:parent.noResults");
    expect(mocks.search).toHaveBeenCalledTimes(2);
  });
});
