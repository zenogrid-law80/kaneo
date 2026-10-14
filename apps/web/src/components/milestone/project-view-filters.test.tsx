import resources from "@i18n/en-US.json";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { createInstance } from "i18next";
import type { ComponentType, ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import type { StatisticsSearch } from "@/components/statistics/statistics-model";
import { useTaskFiltersWithLabelsSupport } from "@/hooks/use-task-filters-with-labels-support";
import { Route as BacklogRoute } from "@/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/backlog";
import { Route as CalendarRoute } from "@/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/calendar";
import { Route as GanttRoute } from "@/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/gantt";
import { Route as HierarchyRoute } from "@/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/hierarchy";
import { Route as StatisticsRoute } from "@/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/statistics";
import { useMilestoneFilters } from "@/store/milestone-filters";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import MilestoneSelect from "./milestone-select";

const state = vi.hoisted(() => ({
  currentId: null as string | null,
  projectId: "project",
  search: {} as StatisticsSearch,
  navigate: vi.fn(),
  queryClient: { getQueryData: () => [] },
  summary: vi.fn((..._args: unknown[]) => ({
    data: [],
    isLoading: false,
    isError: false,
  })),
  monthly: vi.fn((..._args: unknown[]) => ({
    data: { members: [], teams: [] },
    isLoading: false,
    isError: false,
  })),
}));
vi.mock(
  "@/hooks/queries/custom-field/use-get-custom-field-filter-values",
  () => ({ default: () => ({ data: [] }) }),
);
vi.mock(
  "@/hooks/queries/custom-field/use-get-custom-fields-by-project",
  () => ({ default: () => ({ data: [] }) }),
);
vi.mock(
  "@/hooks/queries/custom-field/use-get-all-custom-field-values-by-project",
  () => ({ default: () => ({ getValuesForTask: () => [] }) }),
);
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => state.queryClient,
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useParams: () => ({ projectId: state.projectId, workspaceId: "workspace" }),
    useSearch: () => state.search,
    useNavigate: () => state.navigate,
  }),
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/common/project-layout", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("@/components/task/task-details-sheet", () => ({
  default: () => null,
}));
vi.mock("@/components/shared/modals/create-task-modal", () => ({
  default: () => null,
}));
vi.mock("@/hooks/mutations/task/use-update-task", () => ({
  useUpdateTask: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/components/backlog-list-view", () => ({
  default: ({ project }: { project: ProjectWithTasks }) => (
    <div>
      {[...project.plannedTasks, ...project.archivedTasks].map((task) => (
        <span key={task.id}>{task.title}</span>
      ))}
    </div>
  ),
}));
vi.mock("@/hooks/use-keyboard-shortcuts", () => ({
  useRegisterShortcuts: () => {},
  getModifierKeyText: () => "Ctrl",
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canManageWorkspace: () => true,
    isCheckingPermissions: false,
  }),
}));
vi.mock("@/hooks/queries/workspace/use-workspace-member-statistics", () => ({
  default: state.summary,
}));
vi.mock("@/hooks/queries/workspace/use-member-team-monthly-statistics", () => ({
  default: state.monthly,
}));
vi.mock(
  "@/hooks/queries/workspace-users/use-get-active-workspace-users",
  () => ({
    useGetActiveWorkspaceUsers: () => ({ data: { members: [] } }),
  }),
);
vi.mock("@/hooks/queries/workspace/use-workspace-teams", () => ({
  default: () => ({ data: [] }),
}));
vi.mock("@/hooks/queries/label/use-get-labels-by-workspace", () => ({
  default: () => ({ data: [] }),
}));
vi.mock("@/hooks/queries/task/use-get-tasks", () => ({
  useGetTasks: () => ({ data: project, isLoading: false, isError: false }),
}));
vi.mock("@/store/project", () => ({
  default: () => ({ project, setProject: vi.fn() }),
}));
vi.mock("@/hooks/queries/milestone/use-current-milestone", () => ({
  useCurrentMilestone: () => ({
    data: state.currentId
      ? {
          id: state.currentId,
          name: state.currentId === "beta" ? "Beta" : "Empty",
        }
      : null,
  }),
}));
vi.mock("@/hooks/queries/milestone/use-milestones", () => ({
  useMilestoneOptions: () => ({
    data: {
      pages: [
        {
          data: [
            { id: "beta", name: "Beta", status: "open" },
            { id: "release", name: "Release", status: "closed" },
            { id: "empty", name: "Empty", status: "open" },
          ],
        },
      ],
    },
    isLoading: false,
    isError: false,
  }),
  useMilestone: () => ({}),
}));
vi.mock("@/components/calendar/month-grid", () => ({
  default: ({ tasks }: { tasks: Task[] }) => (
    <div>
      {tasks.map((task) => (
        <span key={task.id}>{task.title}</span>
      ))}
    </div>
  ),
}));
vi.mock("@/components/gantt/gantt-task-bar", () => ({
  GanttTaskBar: ({ task }: { task: Task }) => <span>{task.title}</span>,
}));

function task(id: string, milestoneId: string | null, dueDate: string): Task {
  return {
    id,
    title: `${id} task`,
    milestoneId,
    dueDate,
    number: 1,
    description: null,
    status: "todo",
    priority: null,
    startDate: null,
    position: 1,
    createdAt: "2026-10-01T00:00:00Z",
    userId: null,
    assigneeId: null,
    assigneeName: null,
    projectId: "project",
  };
}
const project = {
  id: "project",
  name: "Project",
  slug: "PRJ",
  columns: [
    {
      id: "todo",
      slug: "todo",
      name: "Todo",
      isFinal: false,
      tasks: [
        task("Parent", "release", "2027-01-01"),
        task("Child", "beta", "2026-10-15"),
      ],
    },
  ],
  plannedTasks: [
    task("Unassigned", null, "2026-10-20"),
    task("PlannedBeta", "beta", "2026-10-21"),
    task("PlannedRelease", "release", "2026-10-22"),
  ],
  archivedTasks: [task("Archived", "beta", "2026-10-21")],
  subtaskRelations: [
    { id: "relation", sourceTaskId: "Parent", targetTaskId: "Child" },
  ],
};

const i18n = createInstance();
void i18n.init({
  lng: "en-US",
  resources: { "en-US": resources },
  defaultNS: "common",
  initAsync: false,
});
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  window.localStorage.clear();
  useMilestoneFilters.setState({ byProject: {} });
  state.projectId = "project";
  state.currentId = null;
  state.search = {};
  state.navigate.mockReset();
  state.navigate.mockImplementation((options) => {
    if (typeof options?.search === "function")
      state.search = options.search(state.search);
  });
  state.summary.mockClear();
  state.monthly.mockClear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

function BoardView() {
  const { filters, updateFilter, filteredProject } =
    useTaskFiltersWithLabelsSupport(
      project as unknown as ProjectWithTasks,
      state.projectId,
    );
  return (
    <>
      <MilestoneSelect
        projectId={state.projectId}
        value={filters.milestone?.[0] ?? null}
        onChange={(value) => updateFilter("milestone", value ? [value] : null)}
        filter
        includeClosed
      />
      {filteredProject?.columns
        .flatMap((column) => column.tasks)
        .map((task) => (
          <span key={task.id}>{task.title}</span>
        ))}
    </>
  );
}

it("follows the current milestone across all views, including late loading, changes and clearing", async () => {
  const routes = [
    BacklogRoute,
    HierarchyRoute,
    GanttRoute,
    CalendarRoute,
    StatisticsRoute,
  ];
  const components = [
    BoardView,
    ...routes.map(
      (route) =>
        (route as unknown as { options: { component: ComponentType } }).options
          .component,
    ),
  ];
  const view = (View: ComponentType) => (
    <I18nextProvider i18n={i18n}>
      <View />
    </I18nextProvider>
  );
  const { rerender } = render(view(BoardView));
  expect(hasTask("Parent")).toBe(true);
  state.currentId = "beta";
  for (const View of components) {
    rerender(view(View));
    expect(
      screen.getByRole("combobox", { name: "Milestones" }).textContent,
    ).toContain("Beta");
  }
  expect(state.summary.mock.lastCall?.[4]).toBe("beta");
  rerender(view(BoardView));
  expect(hasTask("Parent")).toBe(false);
  expect(hasTask("Child")).toBe(true);
  state.currentId = "empty";
  rerender(view(BoardView));
  expect(
    screen.getByRole("combobox", { name: "Milestones" }).textContent,
  ).toContain("Empty");
  expect(hasTask("Child")).toBe(false);
  state.currentId = null;
  rerender(view(BoardView));
  expect(
    screen.getByRole("combobox", { name: "Milestones" }).textContent,
  ).toContain("All milestones");
  expect(hasTask("Parent")).toBe(true);
  expect(hasTask("Child")).toBe(true);
});

it("preserves an explicit filter when the default changes and can opt back in after reload", async () => {
  state.currentId = "beta";
  const view = () => (
    <I18nextProvider i18n={i18n}>
      <BoardView />
    </I18nextProvider>
  );
  const rendered = render(view());
  await selectMilestone("All milestones");
  state.currentId = "empty";
  rendered.rerender(view());
  expect(hasTask("Child")).toBe(true);
  await selectMilestone("Empty");
  expect(hasTask("Child")).toBe(false);
  const saved = window.localStorage.getItem("kaneo-project-milestone-filters");
  rendered.unmount();
  useMilestoneFilters.setState({ byProject: {} });
  window.localStorage.setItem("kaneo-project-milestone-filters", saved!);
  await act(() => useMilestoneFilters.persist.rehydrate());
  state.currentId = "beta";
  render(view());
  expect(hasTask("Child")).toBe(true);
  expect(hasTask("Parent")).toBe(false);
});

it("shares selections and clearing across board, backlog, hierarchy, gantt, calendar and statistics", async () => {
  const components = [
    BoardView,
    ...[
      BacklogRoute,
      HierarchyRoute,
      GanttRoute,
      CalendarRoute,
      StatisticsRoute,
    ].map(
      (route) =>
        (route as unknown as { options: { component: ComponentType } }).options
          .component,
    ),
    BoardView,
  ];
  const view = (View: ComponentType) => (
    <I18nextProvider i18n={i18n}>
      <View />
    </I18nextProvider>
  );
  const { rerender } = render(view(BoardView));
  await selectMilestone("Beta");
  for (const View of components) {
    rerender(view(View));
    expect(
      screen.getByRole("combobox", { name: "Milestones" }).textContent,
    ).toContain("Beta");
  }
  expect(state.summary.mock.lastCall?.[4]).toBe("beta");
  await selectMilestone("No milestone");
  for (const View of components) {
    rerender(view(View));
    expect(
      screen.getByRole("combobox", { name: "Milestones" }).textContent,
    ).toContain("No milestone");
  }
  expect(state.monthly.mock.lastCall?.[4]).toBe("none");
  await selectMilestone("All milestones");
  for (const View of components) {
    rerender(view(View));
    expect(
      screen.getByRole("combobox", { name: "Milestones" }).textContent,
    ).toContain("All milestones");
  }
  expect(state.summary.mock.lastCall?.[4]).toBeUndefined();
});

it("retains each project's selection when leaving and returning", async () => {
  const View = (
    CalendarRoute as unknown as { options: { component: ComponentType } }
  ).options.component;
  const view = () => (
    <I18nextProvider i18n={i18n}>
      <View />
    </I18nextProvider>
  );
  const { rerender } = render(view());
  await selectMilestone("Beta");
  state.projectId = "other-project";
  rerender(view());
  expect(
    screen.getByRole("combobox", { name: "Milestones" }).textContent,
  ).toContain("All milestones");
  await selectMilestone("Release (closed)");
  state.projectId = "project";
  rerender(view());
  expect(
    screen.getByRole("combobox", { name: "Milestones" }).textContent,
  ).toContain("Beta");
  state.projectId = "other-project";
  rerender(view());
  expect(
    screen.getByRole("combobox", { name: "Milestones" }).textContent,
  ).toContain("Release (closed)");
});

it("migrates a saved board selection and does not restore it after clearing in another view", async () => {
  window.localStorage.setItem(
    "kaneo:board-filters:project",
    JSON.stringify({ milestone: ["release"] }),
  );
  const CalendarView = (
    CalendarRoute as unknown as { options: { component: ComponentType } }
  ).options.component;
  const { rerender } = render(
    <I18nextProvider i18n={i18n}>
      <CalendarView />
    </I18nextProvider>,
  );
  expect(
    screen.getByRole("combobox", { name: "Milestones" }).textContent,
  ).toContain("Release (closed)");
  await selectMilestone("All milestones");
  rerender(
    <I18nextProvider i18n={i18n}>
      <BoardView />
    </I18nextProvider>,
  );
  expect(
    screen.getByRole("combobox", { name: "Milestones" }).textContent,
  ).toContain("All milestones");
  expect(hasTask("Child")).toBe(true);
});

it("restores saved selections and preserves an explicit clear after reloading", async () => {
  const storageKey = "kaneo-project-milestone-filters";
  window.localStorage.setItem(
    storageKey,
    JSON.stringify({
      state: {
        byProject: {
          project: "release",
          "other-project": "none",
          invalid: 123,
        },
      },
      version: 0,
    }),
  );
  await act(() => useMilestoneFilters.persist.rehydrate());
  const View = (
    CalendarRoute as unknown as { options: { component: ComponentType } }
  ).options.component;
  const view = () => (
    <I18nextProvider i18n={i18n}>
      <View />
    </I18nextProvider>
  );
  const rendered = render(view());
  expect(
    screen.getByRole("combobox", { name: "Milestones" }).textContent,
  ).toContain("Release (closed)");
  expect(useMilestoneFilters.getState().byProject.invalid).toBeUndefined();
  await selectMilestone("All milestones");
  const saved = window.localStorage.getItem(storageKey);
  rendered.unmount();
  useMilestoneFilters.setState({ byProject: {} });
  window.localStorage.setItem(storageKey, saved ?? "");
  window.localStorage.setItem(
    "kaneo:board-filters:project",
    JSON.stringify({ milestone: ["release"] }),
  );
  await act(() => useMilestoneFilters.persist.rehydrate());
  render(view());
  expect(
    screen.getByRole("combobox", { name: "Milestones" }).textContent,
  ).toContain("All milestones");
  expect(useMilestoneFilters.getState().byProject["other-project"]).toBe(
    "none",
  );
});

it("passes the selected milestone to both statistics queries and clears it on reset", async () => {
  const View = (
    StatisticsRoute as unknown as { options: { component: ComponentType } }
  ).options.component;
  const view = () => (
    <I18nextProvider i18n={i18n}>
      <View />
    </I18nextProvider>
  );
  state.search = {
    startDate: "2026-06-01",
    endDate: "2026-06-30",
    team: "team",
    member: "member",
  };
  const { rerender } = render(view());
  await selectMilestone("Release (closed)");
  const selectedNavigation = state.navigate.mock.lastCall?.[0];
  state.search = selectedNavigation.search(state.search);
  expect(state.search).toMatchObject({
    milestone: "release",
    team: "team",
    member: "member",
  });
  rerender(view());
  expect(state.summary).toHaveBeenLastCalledWith(
    "workspace",
    "project",
    "2026-06-01",
    "2026-06-30",
    "release",
  );
  expect(state.monthly).toHaveBeenLastCalledWith(
    "workspace",
    "project",
    "2026-06-01",
    "2026-06-30",
    "release",
  );
  fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
  const resetNavigation = state.navigate.mock.lastCall?.[0];
  state.search = resetNavigation.search(state.search);
  expect(state.search).toMatchObject({
    milestone: undefined,
    team: "all",
    member: "all",
  });
  rerender(view());
  expect(state.summary.mock.lastCall?.[4]).toBeUndefined();
  expect(state.monthly.mock.lastCall?.[4]).toBeUndefined();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function selectMilestone(name: string) {
  fireEvent.click(screen.getByRole("combobox", { name: "Milestones" }));
  const option = await screen.findByRole("option", { name });
  fireEvent.pointerDown(option, { pointerType: "mouse" });
  fireEvent.click(option);
}
function hasTask(title: string) {
  return screen.queryAllByText(`${title} task`, { exact: true }).length > 0;
}

it("filters planned and archived backlog tasks and clears the shared milestone with all filters", async () => {
  const View = (
    BacklogRoute as unknown as { options: { component: ComponentType } }
  ).options.component;
  render(
    <I18nextProvider i18n={i18n}>
      <View />
    </I18nextProvider>,
  );
  expect(hasTask("PlannedBeta")).toBe(true);
  expect(hasTask("PlannedRelease")).toBe(true);
  expect(hasTask("Unassigned")).toBe(true);
  expect(hasTask("Archived")).toBe(true);
  expect(hasTask("Parent")).toBe(false);
  await selectMilestone("Beta");
  expect(hasTask("PlannedBeta")).toBe(true);
  expect(hasTask("Archived")).toBe(true);
  expect(hasTask("PlannedRelease")).toBe(false);
  expect(hasTask("Unassigned")).toBe(false);
  await selectMilestone("Release (closed)");
  expect(hasTask("PlannedRelease")).toBe(true);
  expect(hasTask("PlannedBeta")).toBe(false);
  expect(hasTask("Archived")).toBe(false);
  await selectMilestone("No milestone");
  expect(hasTask("Unassigned")).toBe(true);
  expect(hasTask("PlannedBeta")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Filter" }));
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Clear all filters" }),
  );
  expect(
    screen.getByRole("combobox", { name: "Milestones" }).textContent,
  ).toContain("All milestones");
  expect(hasTask("PlannedBeta")).toBe(true);
  expect(hasTask("Unassigned")).toBe(true);
  expect(useMilestoneFilters.getState().byProject.project).toBeNull();
});

const views = [
  ["hierarchy", HierarchyRoute],
  ["gantt", GanttRoute],
  ["calendar", CalendarRoute],
] as const;
describe.each(views)("%s milestone filter", (_name, route) => {
  const View = (route as unknown as { options: { component: ComponentType } })
    .options.component;
  function view() {
    return (
      <I18nextProvider i18n={i18n}>
        <View />
      </I18nextProvider>
    );
  }
  it("filters active and planned tasks, supports closed milestones, and restores all tasks", async () => {
    render(view());
    expect(hasTask("Parent")).toBe(true);
    expect(hasTask("Child")).toBe(true);
    expect(hasTask("Unassigned")).toBe(true);
    expect(hasTask("Archived")).toBe(false);
    await selectMilestone("Beta");
    expect(hasTask("Child")).toBe(true);
    expect(hasTask("Parent")).toBe(false);
    expect(hasTask("Unassigned")).toBe(false);
    await selectMilestone("No milestone");
    expect(hasTask("Unassigned")).toBe(true);
    expect(hasTask("Child")).toBe(false);
    await selectMilestone("Release (closed)");
    expect(hasTask("Parent")).toBe(true);
    expect(hasTask("Unassigned")).toBe(false);
    await selectMilestone("All milestones");
    expect(hasTask("Parent")).toBe(true);
    expect(hasTask("Child")).toBe(true);
    expect(hasTask("Unassigned")).toBe(true);
  });
  it("keeps empty filters usable and clears the selection when changing projects", async () => {
    const { rerender } = render(view());
    await selectMilestone("Empty");
    expect(hasTask("Parent")).toBe(false);
    expect(hasTask("Child")).toBe(false);
    expect(hasTask("Unassigned")).toBe(false);
    expect(screen.getByRole("combobox", { name: "Milestones" })).toBeTruthy();
    state.projectId = "other-project";
    rerender(view());
    expect(hasTask("Parent")).toBe(true);
    expect(hasTask("Child")).toBe(true);
  });
});

it("limits the gantt date range to tasks in the selected milestone and combines search", async () => {
  const View = (
    GanttRoute as unknown as { options: { component: ComponentType } }
  ).options.component;
  render(
    <I18nextProvider i18n={i18n}>
      <View />
    </I18nextProvider>,
  );
  expect(screen.queryAllByText("Jan").length).toBeGreaterThan(0);
  await selectMilestone("Beta");
  expect(screen.queryAllByText("Jan")).toHaveLength(0);
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Parent" },
  });
  expect(hasTask("Parent")).toBe(false);
  expect(hasTask("Child")).toBe(false);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Child" } });
  expect(hasTask("Child")).toBe(true);
});
