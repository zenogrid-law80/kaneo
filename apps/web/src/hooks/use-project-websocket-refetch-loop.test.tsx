import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import useGetAssignedTasks from "./queries/task/use-get-assigned-tasks";
import { useGetTasks } from "./queries/task/use-get-tasks";
import { useProjectWebSocket } from "./use-project-websocket";

const mocks = vi.hoisted(() => ({
  board: vi.fn(),
  assigned: vi.fn(),
  task: vi.fn(),
  milestones: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock("@/fetchers/task/get-tasks", () => ({ default: mocks.board }));
vi.mock("@/fetchers/task/get-assigned-tasks", () => ({
  default: mocks.assigned,
}));
vi.mock("@/fetchers/task/get-task", () => ({ default: mocks.task }));
vi.mock("@/fetchers/label/get-labels-by-task", () => ({
  default: async () => [],
}));
vi.mock("@/fetchers/external-link/get-external-links", () => ({
  default: async () => [],
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));
vi.mock("@kaneo/libs", () => ({ windowId: "test-window" }));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: { user: { id: "user" } } }) },
}));

class Socket {
  static current: Socket;
  onmessage: ((event: { data: string }) => void) | null = null;
  close() {}
  constructor() {
    Socket.current = this;
  }
  message(type: string, rest: Record<string, unknown> = {}) {
    this.onmessage?.({
      data: JSON.stringify({ type, projectId: "project", ...rest }),
    });
  }
}

const board = {
  id: "project",
  columns: [
    {
      id: "todo",
      slug: "todo",
      tasks: [
        { id: "task", projectId: "project", status: "todo", title: "Before" },
      ],
    },
  ],
  plannedTasks: [],
  archivedTasks: [],
};
let client: QueryClient;
let finishBoard: (value: unknown) => void;

beforeEach(() => {
  vi.stubGlobal("WebSocket", Socket);
  client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
      },
    },
  });
  // Leave each request pending until the test completes it. A broken replay
  // starts another request without letting the test itself run an infinite loop.
  mocks.board.mockImplementation(
    () =>
      new Promise((resolve) => {
        finishBoard = resolve;
      }),
  );
  mocks.assigned.mockResolvedValue({ tasks: [], total: 1 });
  mocks.milestones.mockResolvedValue([]);
  mocks.task.mockResolvedValue({
    ...board.columns[0].tasks[0],
    title: "After",
  });
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

function Wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function mountBoard(cached = true) {
  if (cached) client.setQueryData(["tasks", "project"], board);
  client.setQueryData(["assigned-tasks", "workspace", { countOnly: true }], {
    tasks: [],
    total: 1,
  });
  client.setQueryData(["milestones", "project"], []);
  return renderHook(
    () => {
      useProjectWebSocket("project");
      const tasks = useGetTasks("project");
      useGetAssignedTasks("workspace", true);
      useQuery({
        queryKey: ["milestones", "project"],
        queryFn: mocks.milestones,
      });
      return tasks;
    },
    { wrapper: Wrapper },
  );
}

it("settles after one milestone event instead of replaying its own board invalidation", async () => {
  const { result } = mountBoard();
  await waitFor(() => expect(mocks.board).toHaveBeenCalledOnce());
  await act(async () => finishBoard(board));
  await waitFor(() => expect(result.current.isFetching).toBe(false));
  mocks.board.mockClear();

  act(() => Socket.current.message("MILESTONES_UPDATED"));
  expect(mocks.board).toHaveBeenCalledOnce();
  await act(async () => finishBoard(board));
  await waitFor(() => expect(mocks.milestones).toHaveBeenCalledOnce());
  expect(mocks.board).toHaveBeenCalledOnce();
  expect(result.current.isFetching).toBe(false);
});

it("replays a task edit queued during milestone refresh once and stops refreshing sidebar counts", async () => {
  const { result } = mountBoard();
  await waitFor(() => expect(mocks.board).toHaveBeenCalledOnce());
  await act(async () => finishBoard(board));
  await waitFor(() => expect(result.current.isFetching).toBe(false));
  mocks.board.mockClear();
  // The sidebar opts into a refresh on mount, so disregard that initial read.
  await waitFor(() => expect(mocks.assigned).toHaveBeenCalledOnce());
  mocks.assigned.mockClear();

  act(() => {
    Socket.current.message("MILESTONES_UPDATED");
    Socket.current.message("TASK_UPDATED", { taskId: "task" });
  });
  expect(mocks.task).not.toHaveBeenCalled();
  await act(async () => finishBoard(board));
  await waitFor(() =>
    expect(mocks.task).toHaveBeenCalledExactlyOnceWith("task", "board"),
  );
  expect(mocks.board).toHaveBeenCalledOnce();
  expect(result.current.isFetching).toBe(false);
  await waitFor(() =>
    expect(result.current.data?.columns[0].tasks[0].title).toBe("After"),
  );
  await waitFor(() =>
    expect(
      client.getQueryState(["assigned-tasks", "workspace", { countOnly: true }])
        ?.fetchStatus,
    ).toBe("idle"),
  );
  const assignedReads = mocks.assigned.mock.calls.length;
  expect(assignedReads).toBeLessThanOrEqual(2);
  await act(async () => {
    for (let update = 0; update < 20; update++)
      client.setQueryData(["tasks", "project"], result.current.data);
  });
  expect(mocks.assigned).toHaveBeenCalledTimes(assignedReads);
  expect(mocks.task).toHaveBeenCalledOnce();
  expect(mocks.board).toHaveBeenCalledOnce();
});

it("reconciles a milestone event during initial pagination once without restarting page one", async () => {
  const { result } = mountBoard(false);
  await waitFor(() => expect(mocks.board).toHaveBeenCalledOnce());
  act(() => Socket.current.message("MILESTONES_UPDATED"));
  expect(mocks.board).toHaveBeenCalledOnce();
  await act(async () => finishBoard(board));
  await waitFor(() => expect(mocks.board).toHaveBeenCalledTimes(2));
  await act(async () => finishBoard(board));
  await waitFor(() => expect(mocks.milestones).toHaveBeenCalledOnce());
  expect(mocks.board).toHaveBeenCalledTimes(2);
  expect(result.current.isFetching).toBe(false);
});

it("refreshes bug caches independently while a task board request is in flight", async () => {
  const bugs = vi.fn().mockResolvedValue([]);
  const template = vi.fn().mockResolvedValue({ template: "Current" });
  renderHook(
    () => {
      useGetTasks("project");
      useQuery({
        queryKey: ["bugs", "project", "list", "new", 1],
        queryFn: bugs,
      });
      useQuery({ queryKey: ["bug-template", "project"], queryFn: template });
      useProjectWebSocket("project");
    },
    {
      wrapper: ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
  await waitFor(() => expect(bugs).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(template).toHaveBeenCalledTimes(1));
  act(() => Socket.current.message("BUGS_UPDATED"));
  await waitFor(() => expect(bugs).toHaveBeenCalledTimes(2));
  expect(template).toHaveBeenCalledTimes(1);
  act(() => Socket.current.message("BUG_TEMPLATE_UPDATED"));
  await waitFor(() => expect(template).toHaveBeenCalledTimes(2));
  expect(mocks.board).toHaveBeenCalledTimes(1);
});
