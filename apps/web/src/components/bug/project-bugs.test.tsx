import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import type { BugFilters } from "@/fetchers/bug";
import type { BugSearch } from "./bug-search";
import ProjectBugs from "./project-bugs";

const current = vi.hoisted(() => ({ data: null as { id: string } | null }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/components/common/project-layout", () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("./bug-filters", () => ({ default: () => null }));
vi.mock("./bug-detail", () => ({ default: () => null }));
vi.mock("./bug-form", () => ({ default: () => null }));
vi.mock("./bug-board", () => ({
  default: ({ filters }: { filters: BugFilters }) => (
    <output data-testid="cards">{JSON.stringify(filters)}</output>
  ),
}));
vi.mock("./bug-list", () => ({
  default: ({ filters }: { filters: BugFilters }) => (
    <output data-testid="list">{JSON.stringify(filters)}</output>
  ),
}));
vi.mock("@/hooks/queries/bug/use-bugs", () => ({
  useBugTemplate: () => ({ data: { template: "Bug template" } }),
}));
vi.mock("@/hooks/mutations/bug/use-bug-mutations", () => ({
  useBugMutations: () => ({}),
}));
vi.mock("@/hooks/queries/milestone/use-current-milestone", () => ({
  useCurrentMilestone: () => current,
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canCreateTasks: () => false,
    canAssignTasks: () => false,
    canUpdateTasks: () => false,
  }),
}));

beforeEach(() => {
  current.data = null;
});
afterEach(cleanup);
const view = (search: BugSearch = {}) => (
  <ProjectBugs projectId="project" workspaceId="workspace" search={search} />
);

it("filters both cards and lists by the current milestone, including delayed loading and changes", () => {
  const rendered = render(view());
  expect(screen.getByTestId("cards")).toHaveTextContent("{}");
  current.data = { id: "release" };
  rendered.rerender(view());
  expect(screen.getByTestId("cards")).toHaveTextContent(
    '{"milestoneId":"release"}',
  );
  rendered.rerender(view({ view: "list", fixerId: "member" }));
  expect(screen.getByTestId("list")).toHaveTextContent(
    '{"fixerId":"member","milestoneId":"release"}',
  );
  current.data = { id: "next" };
  rendered.rerender(view({ view: "list" }));
  expect(screen.getByTestId("list")).toHaveTextContent(
    '{"milestoneId":"next"}',
  );
  current.data = null;
  rendered.rerender(view());
  expect(screen.getByTestId("cards")).toHaveTextContent("{}");
});

it("keeps bookmarked milestone choices and translates all into an unfiltered API query", () => {
  current.data = { id: "current" };
  const rendered = render(view({ milestoneId: "bookmarked" }));
  expect(screen.getByTestId("cards")).toHaveTextContent(
    '{"milestoneId":"bookmarked"}',
  );
  rendered.rerender(view({ milestoneId: "none" }));
  expect(screen.getByTestId("cards")).toHaveTextContent(
    '{"milestoneId":"none"}',
  );
  rendered.rerender(view({ milestoneId: "all", reporterId: "member" }));
  expect(screen.getByTestId("cards")).toHaveTextContent(
    '{"reporterId":"member"}',
  );
});

it("passes search, metadata and sorting to both board and list queries", () => {
  const filters = {
    priority: "urgent,high",
    severity: "critical",
    environment: "production,none",
    search: "재현",
    sortBy: "severity" as const,
    sortOrder: "desc" as const,
  };
  const rendered = render(view(filters));
  expect(JSON.parse(screen.getByTestId("cards").textContent!)).toEqual(filters);
  rendered.rerender(view({ ...filters, view: "list" }));
  expect(JSON.parse(screen.getByTestId("list").textContent!)).toEqual(filters);
});
