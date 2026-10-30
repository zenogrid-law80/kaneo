import { useState } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import BugFilters from "./bug-filters";
import { parseBugSearch, type BugSearch } from "./bug-search";

vi.mock("react-i18next", async (original) => ({
  ...(await original<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: { id: "member", name: "Alice" } }),
}));
vi.mock(
  "@/hooks/queries/workspace-users/use-get-active-workspace-users",
  () => ({
    useGetActiveWorkspaceUsers: () => ({
      data: {
        members: [
          {
            userId: "member",
            user: {
              id: "member",
              name: "Alice",
              email: "alice@example.com",
              image: null,
            },
          },
          {
            userId: "second",
            user: {
              id: "second",
              name: "Bob",
              email: "bob@example.com",
              image: null,
            },
          },
        ],
      },
      isError: false,
      isPending: false,
    }),
  }),
);
vi.mock("@/hooks/queries/workspace/use-workspace-teams", () => ({
  default: () => ({
    data: [
      {
        id: "team",
        name: "QA team",
        userIds: ["member", "second", "former-member"],
      },
    ],
    isError: false,
    isPending: false,
  }),
}));
vi.mock("@/hooks/queries/milestone/use-milestones", () => ({
  useMilestoneOptions: () => ({
    data: { pages: [{ data: [{ id: "release", name: "Release" }] }] },
    hasNextPage: false,
  }),
}));
afterEach(cleanup);
function Harness() {
  const [search, setSearch] = useState<BugSearch>({ view: "cards" });
  return (
    <>
      <BugFilters
        workspaceId="workspace"
        projectId="project"
        search={search}
        onChange={(patch) => setSearch((value) => ({ ...value, ...patch }))}
      />
      <output data-testid="search">{JSON.stringify(search)}</output>
    </>
  );
}
const openFilters = () =>
  fireEvent.click(
    screen.getByRole("button", { name: "common:actions.filter" }),
  );
const openSubmenu = async (name: string | RegExp) => {
  fireEvent.click(await screen.findByRole("menuitem", { name }));
};
const closeMenus = async () => {
  const trigger = screen.getByRole("button", { name: "common:actions.filter" });
  if (trigger.getAttribute("aria-expanded") === "true")
    fireEvent.click(trigger);
  await waitFor(() => expect(screen.queryAllByRole("menu")).toHaveLength(0));
};
it("keeps milestone separate from the people menu, preserves filters across views, and clears them together", async () => {
  render(<Harness />);
  openFilters();
  expect(
    screen.queryByRole("menuitem", { name: "tasks:milestones.title" }),
  ).not.toBeInTheDocument();
  await openSubmenu("tasks:bugs.fixer");
  fireEvent.click(
    await screen.findByRole("menuitemcheckbox", { name: "Alice" }),
  );
  await closeMenus();
  fireEvent.click(screen.getByRole("button", { name: "tasks:bugs.listView" }));
  expect(screen.getByTestId("search")).toHaveTextContent(
    '"view":"list","fixerId":"member"',
  );
  openFilters();
  await openSubmenu("tasks:bugs.verifier");
  fireEvent.click(
    await screen.findByRole("menuitemcheckbox", {
      name: "tasks:boardFilters.unassigned",
    }),
  );
  await closeMenus();
  fireEvent.click(
    screen.getByRole("combobox", { name: "tasks:milestones.title" }),
  );
  const release = await screen.findByRole("option", { name: "Release" });
  fireEvent.pointerDown(release, { pointerType: "mouse" });
  fireEvent.click(release);
  expect(
    screen.getByRole("combobox", { name: "tasks:milestones.title" }),
  ).toHaveTextContent("Release");
  expect(screen.getByTestId("search")).toHaveTextContent(
    '"verifierId":"none","milestoneId":"release"',
  );
  await waitFor(() =>
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
  );
  openFilters();
  fireEvent.click(
    await screen.findByRole("menuitem", {
      name: "common:actions.clearAllFilters",
    }),
  );
  expect(screen.getByTestId("search")).toHaveTextContent('{"view":"list"}');
  expect(
    screen.getByRole("combobox", { name: "tasks:milestones.title" }),
  ).toHaveTextContent("tasks:milestones.all");
});
it("uses the Tasks team groups to select and deselect all active members without losing unassigned", async () => {
  render(<Harness />);
  openFilters();
  await openSubmenu("tasks:bugs.reporter");
  fireEvent.click(
    await screen.findByRole("menuitemcheckbox", {
      name: "tasks:boardFilters.unassigned",
    }),
  );
  await openSubmenu("QA team");
  const allTeam = await screen.findByRole("menuitemcheckbox", {
    name: "tasks:boardFilters.allTeamMembers",
  });
  fireEvent.click(allTeam);
  expect(screen.getByTestId("search")).toHaveTextContent(
    '"reporterId":"none,member,second"',
  );
  expect(allTeam).toHaveAttribute("aria-checked", "true");
  const teamMenu = allTeam.closest('[role="menu"]') as HTMLElement;
  fireEvent.click(
    within(teamMenu).getByRole("menuitemcheckbox", { name: "Bob" }),
  );
  expect(screen.getByTestId("search")).toHaveTextContent(
    '"reporterId":"none,member"',
  );
  expect(allTeam).toHaveAttribute("aria-checked", "false");
  fireEvent.click(allTeam);
  fireEvent.click(allTeam);
  expect(screen.getByTestId("search")).toHaveTextContent('"reporterId":"none"');
});
it("restores single and multi-person bookmarks and ignores malformed parameters", () => {
  expect(
    parseBugSearch({
      view: "list",
      reporterId: "member",
      fixerId: "none,member,member",
      milestoneId: "release",
      bugId: "bug",
    }),
  ).toEqual({
    view: "list",
    reporterId: "member",
    fixerId: "none,member",
    milestoneId: "release",
    bugId: "bug",
  });
  expect(
    parseBugSearch({ view: "invalid", fixerId: ["member"], verifierId: "  " }),
  ).toEqual({ view: "cards" });
});
