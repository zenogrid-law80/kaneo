import { describe, expect, it } from "vitest";
import type { WorkspaceTeam } from "@/hooks/queries/workspace/use-workspace-teams";
import type WorkspaceUser from "@/types/workspace-user";
import {
  groupAssigneeMembers,
  matchesAssigneeSearch,
} from "./assignee-picker-content";

const member = (userId: string, name: string) =>
  ({
    id: `membership-${userId}`,
    userId,
    user: { id: userId, name, email: `${userId}@example.com`, image: null },
  }) as WorkspaceUser;

describe("groupAssigneeMembers", () => {
  it("groups members by team and keeps members without a team available", () => {
    const alice = member("alice", "Alice");
    const bob = member("bob", "Bob");
    const teams: WorkspaceTeam[] = [
      { id: "design", name: "Design", userIds: [alice.userId] },
    ];

    expect(
      groupAssigneeMembers([alice, bob], teams, "All members", "Other members"),
    ).toEqual([
      { value: "design", label: "Design", members: [alice] },
      {
        value: "other-members",
        label: "Other members",
        members: [bob],
      },
    ]);
  });

  it("shows one all-members group when no teams exist", () => {
    const alice = member("alice", "Alice");

    expect(
      groupAssigneeMembers([alice], [], "All members", "Other members"),
    ).toEqual([
      { value: "all-members", label: "All members", members: [alice] },
    ]);
  });
});

describe("matchesAssigneeSearch", () => {
  it.each([
    ["Whimsical Leopard", "%w%", true],
    ["Whimsical Leopard", "w%", true],
    ["Whimsical Leopard", "%leopard", true],
    ["Whimsical Leopard", "w_i%", true],
    ["Whimsical Leopard", "%z%", false],
    ["Whimsical Leopard", "leopard", true],
  ])("matches %s against %s", (name, query, expected) => {
    expect(matchesAssigneeSearch(name, query)).toBe(expected);
  });
});
