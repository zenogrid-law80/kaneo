import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import type { WorkspaceTeam } from "@/hooks/queries/workspace/use-workspace-teams";
import type WorkspaceUser from "@/types/workspace-user";
import AssigneePickerContent from "./assignee-picker-content";

const auth = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: auth.userId ? { id: auth.userId } : null }),
}));
beforeEach(() => {
  auth.userId = null;
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

describe("AssigneePickerContent team navigation", () => {
  it("offers the current member by name above teams and keeps one result when searching", async () => {
    auth.userId = "alice";
    const member = {
      id: "membership-alice",
      userId: "alice",
      user: {
        id: "alice",
        name: "Alice",
        email: "alice@example.com",
        image: null,
      },
    } as WorkspaceUser;
    const onSelect = vi.fn();
    render(
      <AssigneePickerContent
        members={[member]}
        teams={[{ id: "design", name: "Design", userIds: ["alice"] }]}
        selectedUserId={null}
        unassignedSelected
        onSelect={onSelect}
      />,
    );
    const self = screen.getByRole("option", { name: /Alice/ });
    expect(
      self.compareDocumentPosition(
        screen.getByRole("button", { name: "Design" }),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    fireEvent.click(self);
    expect(onSelect).toHaveBeenCalledWith("alice");
    fireEvent.change(
      screen.getByPlaceholderText("tasks:popover.assignee.searchPlaceholder"),
      { target: { value: "alice" } },
    );
    expect(
      await screen.findAllByRole("option", { name: /Alice/ }),
    ).toHaveLength(1);
  });

  it("does not offer a signed-in user outside the workspace", () => {
    auth.userId = "outsider";
    render(
      <AssigneePickerContent
        members={[]}
        teams={[]}
        selectedUserId={null}
        unassignedSelected
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.queryByText("outsider")).toBeNull();
  });

  it("opens team members in a nested popup when the team is clicked", async () => {
    const alice = {
      id: "membership-alice",
      userId: "alice",
      user: {
        id: "alice",
        name: "Alice",
        email: "alice@example.com",
        image: null,
      },
    } as WorkspaceUser;
    const teams: WorkspaceTeam[] = [
      { id: "design", name: "Design", userIds: [alice.userId] },
    ];

    render(
      <AssigneePickerContent
        members={[alice]}
        teams={teams}
        selectedUserId={null}
        unassignedSelected
        onSelect={vi.fn()}
      />,
    );

    expect(screen.queryByText("Alice")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Design/ }));

    expect(await screen.findByText("Alice")).toBeVisible();
    expect(screen.getByText("alice@example.com")).toBeVisible();
  });
});
