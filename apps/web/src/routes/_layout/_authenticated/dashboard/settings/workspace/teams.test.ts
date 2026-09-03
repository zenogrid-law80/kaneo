import { describe, expect, it } from "vitest";
import type WorkspaceUser from "@/types/workspace-user";
import { splitTeamMembers } from "./teams";

const member = (id: string) =>
  ({ id: `membership-${id}`, userId: id }) as WorkspaceUser;

describe("splitTeamMembers", () => {
  it("lists current team members separately from members available to add", () => {
    const currentMember = member("user-1");
    const availableMember = member("user-2");

    expect(
      splitTeamMembers(
        [availableMember, currentMember],
        new Set([currentMember.userId]),
      ),
    ).toEqual({
      currentMembers: [currentMember],
      availableMembers: [availableMember],
    });
  });
});
