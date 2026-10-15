import en from "@i18n/en-US.json";
import ko from "@i18n/ko-KR.json";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import TaskSupportingAssignees from "./task-supporting-assignees";

const state = vi.hoisted(() => ({
  canAssign: true,
  currentUserId: null as string | null,
  selected: [] as Array<{ userId: string; name: string; image: null }>,
  read: vi.fn(),
  teams: vi.fn(),
  write: vi.fn(),
  clear: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({
    user: state.currentUserId ? { id: state.currentUserId } : null,
  }),
}));
vi.mock("@/fetchers/workspace/get-workspace-teams", () => ({
  default: state.teams,
}));
vi.mock("@/fetchers/task/get-task-supporting-assignees", () => ({
  default: state.read,
}));
vi.mock("@/fetchers/task/set-task-supporting-assignee", () => ({
  default: state.write,
}));
vi.mock("@/fetchers/task/clear-task-supporting-assignees", () => ({
  default: state.clear,
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canAssignTasks: () => state.canAssign }),
}));
vi.mock(
  "@/hooks/queries/workspace-users/use-get-active-workspace-users",
  () => ({
    useGetActiveWorkspaceUsers: () => ({
      data: {
        members: ["Alice", "Bob"].map((name) => ({
          userId: name,
          user: { name, image: null },
        })),
      },
    }),
  }),
);
vi.mock("@/lib/toast", () => ({ toast: { error: state.toast } }));

const clients: QueryClient[] = [];
function view(locale = "en-US", primaryAssigneeId: string | null = null) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  const i18n = createInstance();
  void i18n.init({
    lng: locale,
    resources: { "en-US": en, "ko-KR": ko },
    initAsync: false,
  });
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <TaskSupportingAssignees
          primaryAssigneeId={primaryAssigneeId}
          taskId="task"
          projectId="project"
          workspaceId="workspace"
        />
      </I18nextProvider>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  state.canAssign = true;
  state.currentUserId = null;
  state.selected = [];
  state.teams.mockReset().mockResolvedValue([]);
  state.read.mockReset().mockImplementation(async () => [...state.selected]);
  state.write.mockReset().mockImplementation(async ({ userId, assigned }) => {
    state.selected = assigned
      ? [...state.selected, { userId, name: userId, image: null }]
      : state.selected.filter((item) => item.userId !== userId);
  });
  state.clear.mockReset().mockImplementation(async () => {
    state.selected = [];
  });
  state.toast.mockReset();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.unstubAllGlobals();
});

it("selects multiple people, searches, and removes an assignment while showing names in Korean", async () => {
  view("ko-KR");
  const trigger = screen.getByRole("button", { name: "보조 담당자" });
  await waitFor(() => expect(trigger).toBeEnabled());
  fireEvent.click(trigger);
  fireEvent.click(await screen.findByRole("button", { name: "모든 멤버" }));
  fireEvent.click(await screen.findByRole("checkbox", { name: "Alice" }));
  await waitFor(() => expect(trigger).toHaveTextContent("Alice"));
  await waitFor(() =>
    expect(screen.getByRole("checkbox", { name: "Bob" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    ),
  );
  fireEvent.click(screen.getByRole("checkbox", { name: "Bob" }));
  await waitFor(() => expect(trigger).toHaveTextContent("Alice"));
  fireEvent.keyDown(screen.getByRole("checkbox", { name: "Bob" }), {
    key: "Escape",
  });
  fireEvent.change(screen.getByRole("textbox", { name: "멤버 검색…" }), {
    target: { value: "alice" },
  });
  expect(screen.queryByRole("checkbox", { name: "Bob" })).toBeNull();
  await waitFor(() =>
    expect(screen.getByRole("checkbox", { name: "Alice" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    ),
  );
  fireEvent.click(screen.getByRole("checkbox", { name: "Alice" }));
  await waitFor(() => expect(trigger).not.toHaveTextContent("Alice"));
  expect(trigger).toHaveTextContent("Bob");
  expect(state.write).toHaveBeenLastCalledWith(
    { taskId: "task", userId: "Alice", assigned: false },
    expect.anything(),
  );
});

it("displays assignments without editing controls for viewers", async () => {
  state.canAssign = false;
  state.selected = [{ userId: "Alice", name: "Alice", image: null }];
  view();
  expect(await screen.findByText("Alice")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Supporting assignees" }),
  ).toBeNull();
  expect(state.write).not.toHaveBeenCalled();
});

it("keeps selection unchanged and reports a translated mutation error", async () => {
  state.write.mockRejectedValueOnce(new Error("failed"));
  view("ko-KR");
  const trigger = screen.getByRole("button", { name: "보조 담당자" });
  await waitFor(() => expect(trigger).toBeEnabled());
  fireEvent.click(trigger);
  fireEvent.click(await screen.findByRole("button", { name: "모든 멤버" }));
  fireEvent.click(await screen.findByRole("checkbox", { name: "Alice" }));
  await waitFor(() =>
    expect(state.toast).toHaveBeenCalledWith(
      "보조 담당자를 변경하지 못했습니다",
    ),
  );
  expect(screen.getByRole("checkbox", { name: "Alice" })).not.toBeChecked();
  expect(trigger).toHaveTextContent("없음");
});

it("offers a retry when assignments fail to load", async () => {
  state.read.mockRejectedValueOnce(new Error("offline"));
  view();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Could not load supporting assignees",
  );
  fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Supporting assignees" }),
    ).toBeEnabled(),
  );
});

it("opens team depth, selects across teams and unassigns a shared member", async () => {
  state.teams.mockResolvedValue([
    { id: "design", name: "Design", userIds: ["Alice"] },
    { id: "engineering", name: "Engineering", userIds: ["Alice", "Bob"] },
  ]);
  view();
  const trigger = screen.getByRole("button", { name: "Supporting assignees" });
  await waitFor(() => expect(trigger).toBeEnabled());
  fireEvent.click(trigger);
  fireEvent.click(await screen.findByRole("button", { name: "Design" }));
  expect(screen.queryByRole("checkbox", { name: "Bob" })).toBeNull();
  fireEvent.click(await screen.findByRole("checkbox", { name: "Alice" }));
  await waitFor(() => expect(trigger).toHaveTextContent("Alice"));
  fireEvent.keyDown(screen.getByRole("checkbox", { name: "Alice" }), {
    key: "Escape",
  });
  fireEvent.click(screen.getByRole("button", { name: "Engineering" }));
  expect(await screen.findByRole("checkbox", { name: "Alice" })).toBeChecked();
  await waitFor(() =>
    expect(screen.getByRole("checkbox", { name: "Bob" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("checkbox", { name: "Bob" }));
  await waitFor(() => expect(trigger).toHaveTextContent("Alice"));
  await waitFor(() =>
    expect(screen.getByRole("checkbox", { name: "Alice" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("checkbox", { name: "Alice" }));
  await waitFor(() => expect(trigger).not.toHaveTextContent("Alice"));
  expect(trigger).toHaveTextContent("Bob");
});

it("keeps members without a team accessible and searches across teams without duplicates", async () => {
  state.teams.mockResolvedValue([
    { id: "design", name: "Design", userIds: ["Alice"] },
    { id: "engineering", name: "Engineering", userIds: ["Alice"] },
    { id: "empty", name: "Empty", userIds: ["former-member"] },
  ]);
  view();
  const trigger = screen.getByRole("button", { name: "Supporting assignees" });
  await waitFor(() => expect(trigger).toBeEnabled());
  fireEvent.click(trigger);
  fireEvent.click(await screen.findByRole("button", { name: "Other members" }));
  expect(await screen.findByRole("checkbox", { name: "Bob" })).toBeVisible();
  expect(screen.queryByRole("checkbox", { name: "Alice" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Empty" })).toBeNull();
  fireEvent.keyDown(screen.getByRole("checkbox", { name: "Bob" }), {
    key: "Escape",
  });
  fireEvent.change(screen.getByRole("textbox", { name: "Search members…" }), {
    target: { value: "%ali%" },
  });
  expect(
    await screen.findAllByRole("checkbox", { name: "Alice" }),
  ).toHaveLength(1);
  expect(screen.queryByRole("checkbox", { name: "Bob" })).toBeNull();
});

it("retries failed team loading before showing team choices", async () => {
  state.teams.mockRejectedValueOnce(new Error("offline"));
  view();
  const trigger = screen.getByRole("button", { name: "Supporting assignees" });
  await waitFor(() => expect(trigger).toBeEnabled());
  fireEvent.click(trigger);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Could not load supporting assignees",
  );
  fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
  expect(
    await screen.findByRole("button", { name: "All members" }),
  ).toBeVisible();
});

it("offers the current member above teams for immediate assignment and removal", async () => {
  state.currentUserId = "Alice";
  state.teams.mockResolvedValue([
    { id: "design", name: "Design", userIds: ["Alice", "Bob"] },
  ]);
  view("ko-KR");
  const trigger = screen.getByRole("button", { name: "보조 담당자" });
  await waitFor(() => expect(trigger).toBeEnabled());
  fireEvent.click(trigger);
  const self = await screen.findByRole("checkbox", { name: "Alice" });
  expect(
    self.compareDocumentPosition(
      screen.getByRole("button", { name: "Design" }),
    ) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  fireEvent.click(self);
  await waitFor(() => expect(trigger).toHaveTextContent("Alice"));
  await waitFor(() =>
    expect(self).not.toHaveAttribute("aria-disabled", "true"),
  );
  expect(self).toBeChecked();
  fireEvent.click(self);
  await waitFor(() => expect(trigger).toHaveTextContent("없음"));
  fireEvent.change(screen.getByRole("textbox", { name: "멤버 검색…" }), {
    target: { value: "alice" },
  });
  expect(screen.getAllByRole("checkbox", { name: "Alice" })).toHaveLength(1);
});

it("keeps the current member shortcut disabled when they are the primary assignee", async () => {
  state.currentUserId = "Alice";
  view("ko-KR", "Alice");
  const trigger = screen.getByRole("button", { name: "보조 담당자" });
  await waitFor(() => expect(trigger).toBeEnabled());
  fireEvent.click(trigger);
  const self = await screen.findByRole("checkbox", {
    name: /Alice.*주 담당자/,
  });
  expect(self).toHaveAttribute("aria-disabled", "true");
  fireEvent.click(self);
  expect(state.write).not.toHaveBeenCalled();
});

it("disables the primary assignee in both team depth and search while leaving other members selectable", async () => {
  state.teams.mockResolvedValue([
    { id: "team", name: "Team", userIds: ["Alice", "Bob"] },
  ]);
  state.selected = [{ userId: "Alice", name: "Alice", image: null }];
  view("ko-KR", "Alice");
  const trigger = screen.getByRole("button", { name: "보조 담당자" });
  await waitFor(() => expect(trigger).toBeEnabled());
  expect(trigger).not.toHaveTextContent("Alice");
  fireEvent.click(trigger);
  fireEvent.click(await screen.findByRole("button", { name: "Team" }));
  const primary = await screen.findByRole("checkbox", {
    name: /Alice.*주 담당자/,
  });
  expect(primary).toHaveAttribute("aria-disabled", "true");
  expect(primary).not.toBeChecked();
  fireEvent.click(primary);
  expect(state.write).not.toHaveBeenCalled();
  expect(screen.getByRole("checkbox", { name: "Bob" })).toBeEnabled();
  fireEvent.keyDown(screen.getByRole("checkbox", { name: "Bob" }), {
    key: "Escape",
  });
  fireEvent.change(screen.getByRole("textbox", { name: "멤버 검색…" }), {
    target: { value: "alice" },
  });
  expect(
    await screen.findByRole("checkbox", { name: /Alice.*주 담당자/ }),
  ).toHaveAttribute("aria-disabled", "true");
});

it("clears every assignment even while search hides selected members, and refreshes activity", async () => {
  state.selected = ["Alice", "Bob"].map((name) => ({
    userId: name,
    name,
    image: null,
  }));
  view("ko-KR");
  const client = clients[clients.length - 1];
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const trigger = screen.getByRole("button", { name: "보조 담당자" });
  await waitFor(() => expect(trigger).toHaveTextContent("Alice"));
  fireEvent.click(trigger);
  fireEvent.change(await screen.findByRole("textbox", { name: "멤버 검색…" }), {
    target: { value: "alice" },
  });
  fireEvent.click(screen.getByRole("button", { name: "모두 해제" }));
  await waitFor(() => expect(trigger).toHaveTextContent("없음"));
  expect(state.clear).toHaveBeenCalledExactlyOnceWith(
    { taskId: "task" },
    expect.anything(),
  );
  expect(state.write).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "모두 해제" })).toBeDisabled();
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["activities", "task"] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["workspace-activity"] });
});

it("prevents repeated clears and member changes while clearing, and preserves selection on failure", async () => {
  state.selected = [{ userId: "Alice", name: "Alice", image: null }];
  let reject!: (reason: Error) => void;
  state.clear.mockImplementationOnce(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  view();
  const trigger = screen.getByRole("button", { name: "Supporting assignees" });
  await waitFor(() => expect(trigger).toHaveTextContent("Alice"));
  fireEvent.click(trigger);
  fireEvent.change(
    await screen.findByRole("textbox", { name: "Search members…" }),
    {
      target: { value: "alice" },
    },
  );
  const clear = screen.getByRole("button", { name: "Clear all" });
  fireEvent.click(clear);
  await waitFor(() => expect(clear).toBeDisabled());
  expect(screen.getByRole("checkbox", { name: "Alice" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  fireEvent.click(clear);
  expect(state.clear).toHaveBeenCalledTimes(1);
  reject(new Error("offline"));
  await waitFor(() =>
    expect(state.toast).toHaveBeenCalledWith(
      "Could not update supporting assignees",
    ),
  );
  expect(trigger).toHaveTextContent("Alice");
  await waitFor(() => expect(clear).toBeEnabled());
});

it("shows the first assigned name and opens all names from +N in assignment order", async () => {
  state.selected = ["Zoe", "Alice", "Bob"].map((name) => ({
    userId: name,
    name,
    image: null,
  }));
  view("ko-KR");
  const trigger = screen.getByRole("button", {
    name: "보조 담당자",
  });
  await waitFor(() => expect(trigger).toHaveTextContent("Zoe"));
  expect(trigger).not.toHaveTextContent("Alice");
  expect(trigger).not.toHaveTextContent("Bob");
  const overflow = screen.getByRole("button", {
    name: "보조 담당자 전체 보기 (3명)",
  });
  expect(overflow).toHaveTextContent("+2");
  fireEvent.click(overflow);
  const popup = await screen.findByRole("dialog", { name: "보조 담당자" });
  expect(
    within(popup)
      .getAllByRole("listitem")
      .map((item) => item.querySelector("span.break-words")?.textContent),
  ).toEqual(["Zoe", "Alice", "Bob"]);
  expect(within(popup).queryByRole("checkbox")).toBeNull();
  expect(within(popup).queryByRole("button", { name: "모두 해제" })).toBeNull();
  expect(state.write).not.toHaveBeenCalled();
  fireEvent.keyDown(popup, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("lets viewers open the complete list without assignment permission", async () => {
  state.canAssign = false;
  state.selected = ["Zoe", "Alice", "Bob"].map((name) => ({
    userId: name,
    name,
    image: null,
  }));
  view();
  expect(await screen.findByText("Zoe")).toBeVisible();
  expect(screen.queryByText("Alice")).toBeNull();
  const overflow = screen.getByRole("button", {
    name: "View all supporting assignees (3)",
  });
  fireEvent.click(overflow);
  const popup = await screen.findByRole("dialog", {
    name: "Supporting assignees",
  });
  expect(within(popup).getByText("Zoe")).toBeVisible();
  expect(within(popup).getByText("Alice")).toBeVisible();
  expect(within(popup).getByText("Bob")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Supporting assignees" }),
  ).toBeNull();
  expect(state.write).not.toHaveBeenCalled();
  expect(state.clear).not.toHaveBeenCalled();
});

it("omits the primary assignee and removes the overflow button when only one supporter remains", async () => {
  state.selected = ["Zoe", "Alice", "Bob"].map((name) => ({
    userId: name,
    name,
    image: null,
  }));
  view("en-US", "Zoe");
  const trigger = screen.getByRole("button", {
    name: "Supporting assignees",
  });
  await waitFor(() => expect(trigger).toHaveTextContent("Alice"));
  expect(
    screen.getByRole("button", { name: "View all supporting assignees (2)" }),
  ).toHaveTextContent("+1");
  fireEvent.click(trigger);
  fireEvent.click(await screen.findByRole("button", { name: "All members" }));
  fireEvent.click(await screen.findByRole("checkbox", { name: "Alice" }));
  await waitFor(() => expect(trigger).toHaveTextContent("Bob"));
  expect(
    screen.queryByRole("button", { name: /View all supporting assignees/ }),
  ).toBeNull();
});
