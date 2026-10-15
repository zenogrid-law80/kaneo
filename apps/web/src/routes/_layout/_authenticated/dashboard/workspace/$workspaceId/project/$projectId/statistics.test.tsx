import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import type {
  Month,
  StatisticsSearch,
} from "@/components/statistics/statistics-model";
import { Route } from "./statistics";

const m = vi.hoisted(() => ({
  search: {} as StatisticsSearch,
  navigate: vi.fn(),
  canManage: true,
  checkingPermissions: false,
  summary: vi.fn(),
  people: vi.fn(),
  retrySummary: vi.fn(),
  retryPeople: vi.fn(),
}));

vi.mock("@/hooks/queries/milestone/use-current-milestone", () => ({
  useCurrentMilestone: () => ({ data: null }),
}));
vi.mock("@/hooks/queries/milestone/use-milestones", () => ({
  useMilestoneOptions: () => ({ data: { pages: [{ data: [] }] } }),
  useMilestone: () => ({}),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({
    ...options,
    useParams: () => ({ workspaceId: "w1", projectId: "p1" }),
    useSearch: () => m.search,
    useNavigate: () => m.navigate,
  }),
  Link: ({
    children,
    params,
  }: {
    children: ReactNode;
    params: { workspaceId: string; projectId: string; taskId: string };
  }) => (
    <a
      href={`/workspaces/${params.workspaceId}/projects/${params.projectId}/tasks/${params.taskId}`}
    >
      {children}
    </a>
  ),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/common/project-layout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("@/components/statistics/monthly-task-chart", () => ({
  default: ({ points }: { points: Month[] }) => (
    <output aria-label="Task trend">{JSON.stringify(points)}</output>
  ),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canManageWorkspace: () => m.canManage,
    isCheckingPermissions: m.checkingPermissions,
  }),
}));
vi.mock("@/hooks/queries/workspace/use-workspace-member-statistics", () => ({
  default: m.summary,
}));
vi.mock("@/hooks/queries/workspace/use-member-team-monthly-statistics", () => ({
  default: m.people,
}));

const alice = {
  userId: "alice",
  name: "Alice",
  assignedTasks: 10,
  completedTasks: 6,
  inProgressTasks: 4,
  overdueTasks: 1,
  overdueTaskItems: [{ id: "late", title: "Late task", projectId: "p1" }],
};
const bob = {
  userId: "bob",
  name: "Bob",
  assignedTasks: 5,
  completedTasks: 5,
  inProgressTasks: 0,
  overdueTasks: 0,
  overdueTaskItems: [],
};
const aliceMonths = [{ month: "2026-09", createdTasks: 5, completedTasks: 3 }];
const bobMonths = [{ month: "2026-09", createdTasks: 2, completedTasks: 1 }];

beforeEach(() => {
  vi.clearAllMocks();
  m.canManage = true;
  m.checkingPermissions = false;
  m.search = {
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    view: "overview",
  };
  m.summary.mockReturnValue({
    data: [alice, bob],
    isLoading: false,
    isError: false,
    refetch: m.retrySummary,
  });
  m.people.mockReturnValue({
    data: {
      members: [
        { ...alice, months: aliceMonths },
        { ...bob, months: bobMonths },
      ],
      teams: [
        { teamId: "engineering", teamName: "Engineering", userIds: ["alice"] },
        { teamId: "quality", teamName: "Quality", userIds: ["alice", "bob"] },
      ],
    },
    isLoading: false,
    isError: false,
    refetch: m.retryPeople,
  });
});
afterEach(cleanup);

const Component = (Route as unknown as { component: ComponentType }).component;

function metric(label: string, value: string) {
  const card = screen.getAllByText(label)[0]?.parentElement;
  expect(card).not.toBeNull();
  expect(within(card as HTMLElement).getByText(value)).toBeVisible();
}

function nextSearch() {
  const navigation = m.navigate.mock.calls.at(-1)?.[0] as {
    search: (previous: StatisticsSearch) => StatisticsSearch;
    replace: boolean;
  };
  expect(navigation.replace).toBe(true);
  return navigation.search(m.search);
}

async function chooseFilter(label: string, optionName: string) {
  fireEvent.click(screen.getByRole("combobox", { name: label }), { detail: 1 });
  const option = await screen.findByRole("option", { name: optionName });
  fireEvent.pointerDown(option);
  fireEvent.mouseDown(option);
  fireEvent.pointerUp(option);
  fireEvent.mouseUp(option);
  fireEvent.click(option, { detail: 1 });
  await waitFor(() => expect(m.navigate).toHaveBeenCalled());
}

describe("project statistics page", () => {
  it("includes supporting assignees in both statistics queries and resets the selection", () => {
    const { rerender } = render(<Component />);
    const option = screen.getByRole("checkbox", {
      name: "tasks:supportingAssignees.includeInStatistics",
    });
    expect(option).not.toBeChecked();
    fireEvent.click(option);
    m.search = nextSearch();
    expect(m.search.includeSupportingAssignees).toBe(true);
    rerender(<Component />);
    expect(m.summary.mock.lastCall?.[5]).toBe(true);
    expect(m.people.mock.lastCall?.[5]).toBe(true);
    expect(
      screen.getByText(/tasks:supportingAssignees.statisticsBasis/),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "statistics:filters.reset" }),
    );
    m.search = nextSearch();
    rerender(<Component />);
    expect(m.search.includeSupportingAssignees).toBeUndefined();
    expect(m.summary.mock.lastCall?.[5]).toBe(false);
    expect(m.people.mock.lastCall?.[5]).toBe(false);
  });
  it("disables statistics queries and hides cached data for non-admins", () => {
    m.canManage = false;
    render(<Component />);
    expect(screen.getByText("settings:workspaceRoles.noAccess")).toBeVisible();
    expect(m.summary).toHaveBeenLastCalledWith(
      "",
      "p1",
      "2026-09-01",
      "2026-09-30",
      undefined,
      false,
    );
    expect(m.people).toHaveBeenLastCalledWith(
      "",
      "p1",
      "2026-09-01",
      "2026-09-30",
      undefined,
      false,
    );
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText("statistics:columns.assigned")).toBeNull();
    expect(screen.queryByText("Late task")).toBeNull();
  });

  it("shows summary cards, the overview trend and linked overdue tasks", () => {
    render(<Component />);
    expect(m.summary).toHaveBeenLastCalledWith(
      "w1",
      "p1",
      "2026-09-01",
      "2026-09-30",
      undefined,
      false,
    );
    metric("statistics:columns.assigned", "15");
    metric("statistics:columns.completed", "11");
    metric("statistics:renewal.open", "4");
    metric("statistics:columns.overdue", "1");
    metric("statistics:columns.completionRate", "73%");
    expect(
      screen.getByRole("tab", { name: "statistics:renewal.overview" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Task trend")).toHaveTextContent(
      JSON.stringify([
        { month: "2026-09", createdTasks: 7, completedTasks: 4 },
      ]),
    );
    expect(screen.getByRole("link", { name: "Late task" })).toHaveAttribute(
      "href",
      "/workspaces/w1/projects/p1/tasks/late",
    );
  });

  it("shares member and team filters with cards and the overview chart, resetting the member when the team changes", async () => {
    m.search = { ...m.search, schedule: "all" };
    const { rerender } = render(<Component />);
    await chooseFilter("statistics:filters.member", "Bob");
    m.search = nextSearch();
    expect(m.search).toEqual({
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      view: "overview",
      schedule: "all",
      member: "bob",
    });
    rerender(<Component />);
    metric("statistics:columns.assigned", "5");
    metric("statistics:columns.completionRate", "100%");
    expect(screen.getByLabelText("Task trend")).toHaveTextContent(
      JSON.stringify(bobMonths),
    );
    expect(screen.queryByRole("link", { name: "Late task" })).toBeNull();

    m.navigate.mockClear();
    await chooseFilter("statistics:filters.team", "Engineering");
    m.search = nextSearch();
    expect(m.search).toMatchObject({
      team: "engineering",
      member: "all",
      view: "overview",
      schedule: "all",
    });
    rerender(<Component />);
    metric("statistics:columns.assigned", "10");
    metric("statistics:columns.completionRate", "60%");
    expect(screen.getByLabelText("Task trend")).toHaveTextContent(
      JSON.stringify(aliceMonths),
    );
    expect(screen.getByRole("link", { name: "Late task" })).toBeVisible();
  });

  it("persists tab navigation in the URL and opens only the chosen member or team detail", () => {
    const { rerender } = render(<Component />);
    fireEvent.click(
      screen.getByRole("tab", { name: "statistics:filters.member" }),
    );
    m.search = nextSearch();
    expect(m.search).toMatchObject({
      view: "members",
      startDate: "2026-09-01",
      endDate: "2026-09-30",
    });
    rerender(<Component />);
    expect(
      screen.getByRole("tab", { name: "statistics:filters.member" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByLabelText("Task trend")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Alice" }));
    expect(screen.getByRole("button", { name: "Alice" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("Task trend")).toHaveTextContent(
      JSON.stringify(aliceMonths),
    );
    expect(screen.getByRole("link", { name: "Late task" })).toBeVisible();

    fireEvent.click(
      screen.getByRole("tab", { name: "statistics:filters.team" }),
    );
    m.search = nextSearch();
    rerender(<Component />);
    expect(m.search.view).toBe("teams");
    expect(screen.queryByLabelText("Task trend")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Quality" }));
    expect(screen.getByRole("button", { name: "Quality" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("Task trend")).toHaveTextContent(
      JSON.stringify([
        { month: "2026-09", createdTasks: 7, completedTasks: 4 },
      ]),
    );
  });

  it.each(["member", "team"] as const)(
    "explains an explicit no-%s selection without displaying stale detail",
    (filter) => {
      m.search = { ...m.search, [filter]: "none", view: "members" };
      render(<Component />);
      expect(screen.getByText("statistics:renewal.noneSelected")).toBeVisible();
      expect(screen.queryByRole("tablist")).toBeNull();
      expect(screen.queryByLabelText("Task trend")).toBeNull();
      metric("statistics:columns.assigned", "0");
    },
  );

  it("provides a single retry action for either statistics request failing", () => {
    m.people.mockReturnValue({
      isLoading: false,
      isError: true,
      refetch: m.retryPeople,
    });
    render(<Component />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "statistics:renewal.error",
    );
    expect(screen.queryByText("statistics:columns.assigned")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "statistics:renewal.retry" }),
    );
    expect(m.retrySummary).toHaveBeenCalledOnce();
    expect(m.retryPeople).toHaveBeenCalledOnce();
  });
});
