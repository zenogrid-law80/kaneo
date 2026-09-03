import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceTeam } from "@/hooks/queries/workspace/use-workspace-teams";
import type WorkspaceUser from "@/types/workspace-user";
import AssigneePickerContent from "./assignee-picker-content";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

describe("AssigneePickerContent team navigation", () => {
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
