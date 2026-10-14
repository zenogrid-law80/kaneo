import resources from "@i18n/en-US.json";
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
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import MilestoneDetail from "./milestone-detail";

const state = vi.hoisted(() => ({
  manage: true,
  edit: true,
  status: "open",
  isCurrent: false,
  error: false,
  update: vi.fn(),
  remove: vi.fn(),
  assign: vi.fn(),
}));
vi.mock("@/hooks/queries/milestone/use-milestones", () => ({
  useMilestone: () => ({
    isLoading: false,
    isError: state.error,
    refetch: vi.fn(),
    data: {
      id: "m1",
      projectId: "p1",
      name: "Beta",
      description: null,
      dueDate: null,
      status: state.status,
      isCurrent: state.isCurrent,
      totalTasks: 2,
      completedTasks: 1,
      archivedTasks: 0,
      progressPercent: 50,
    },
  }),
  useMilestoneTasks: () => ({
    isLoading: false,
    isError: false,
    data: {
      data: [{ id: "t1", number: 1, title: "Ship it" }],
      pagination: { totalPages: 1 },
    },
  }),
}));
vi.mock("@/hooks/mutations/milestone/use-milestone-mutations", () => ({
  useMilestoneMutations: () => ({
    create: { mutateAsync: vi.fn() },
    update: { mutateAsync: state.update, isPending: false },
    remove: { mutateAsync: state.remove, isPending: false },
  }),
  useSetTaskMilestone: () => ({ mutateAsync: state.assign, isPending: false }),
}));
vi.mock("@/hooks/mutations/task/use-create-task", () => ({
  default: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/queries/column/use-get-columns", () => ({
  useGetColumns: () => ({ data: [{ slug: "to-do", isFinal: false }] }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canUpdateProjects: () => state.manage,
    canUpdateTasks: () => state.edit,
    canCreateTasks: () => state.edit,
  }),
}));
vi.mock("@/components/task/task-details-sheet", () => ({
  default: () => null,
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn() } }));
const i18n = createInstance();
void i18n.init({
  lng: "en-US",
  resources: { "en-US": resources },
  defaultNS: "common",
  initAsync: false,
});
afterEach(cleanup);
beforeEach(() => {
  state.manage = true;
  state.edit = true;
  state.status = "open";
  state.isCurrent = false;
  state.error = false;
  state.update.mockReset().mockResolvedValue({});
  state.remove.mockReset().mockResolvedValue({});
  state.assign.mockReset().mockResolvedValue({});
});
function detail() {
  const back = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <MilestoneDetail id="m1" projectId="p1" workspaceId="w1" onBack={back} />
    </I18nextProvider>,
  );
  return back;
}
describe("milestone details", () => {
  it("shows the current milestone badge while designation is managed from the list", () => {
    state.isCurrent = true;
    detail();
    expect(screen.getByText("Current")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Clear current milestone" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Set as current milestone" }),
    ).toBeNull();
  });
  it("shows progress but no mutation actions to viewers", () => {
    state.manage = false;
    state.edit = false;
    detail();
    expect(screen.getByText("1 / 2 tasks completed · 50%")).toBeTruthy();
    for (const name of [
      "Edit milestone",
      "Set as current milestone",
      "Close milestone",
      "Delete milestone",
      "Link existing tasks",
      "Unlink",
    ])
      expect(screen.queryByRole("button", { name })).toBeNull();
  });
  it("closes a milestone explicitly while unfinished tasks remain", async () => {
    detail();
    fireEvent.click(screen.getByRole("button", { name: "Close milestone" }));
    await waitFor(() =>
      expect(state.update).toHaveBeenCalledWith({
        id: "m1",
        input: { status: "closed" },
      }),
    );
    expect(state.assign).not.toHaveBeenCalled();
  });
  it("supports reopening and unlinking existing tasks in closed milestones", async () => {
    state.status = "closed";
    detail();
    expect(
      screen.queryByRole("button", { name: "Link existing tasks" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reopen milestone" }));
    await waitFor(() =>
      expect(state.update).toHaveBeenCalledWith({
        id: "m1",
        input: { status: "open" },
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Unlink" }));
    await waitFor(() =>
      expect(state.assign).toHaveBeenCalledWith({
        taskId: "t1",
        milestoneId: null,
      }),
    );
  });
  it("hides stale actions when a remotely deleted milestone fails to refetch", () => {
    state.error = true;
    detail();
    expect(screen.getByText("This milestone is unavailable.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit milestone" })).toBeNull();
  });
  it("keeps the delete confirmation open after a failed deletion", async () => {
    state.remove.mockRejectedValue(new Error("Failed"));
    const back = detail();
    fireEvent.click(screen.getByRole("button", { name: "Delete milestone" }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete milestone" }),
    );
    await waitFor(() => expect(state.remove).toHaveBeenCalledWith("m1"));
    expect(back).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });
});
