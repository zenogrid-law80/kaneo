import type { WorkspaceTeam } from "@/hooks/queries/workspace/use-workspace-teams";
import type WorkspaceUser from "@/types/workspace-user";

type MemberGroup = {
  value: string;
  label: string;
  members: WorkspaceUser[];
};

export function matchesAssigneeSearch(
  itemValue: unknown,
  query: string,
  itemToString?: (itemValue: unknown) => string,
) {
  const candidate = (
    itemToString?.(itemValue) ?? String(itemValue)
  ).toLocaleLowerCase();
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (!normalizedQuery) return true;
  if (!normalizedQuery.includes("%") && !normalizedQuery.includes("_")) {
    return candidate.includes(normalizedQuery);
  }

  const pattern = normalizedQuery
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replaceAll("%", ".*")
    .replaceAll("_", ".");

  return new RegExp(`^${pattern}$`, "u").test(candidate);
}

export function groupAssigneeMembers(
  members: WorkspaceUser[],
  teams: WorkspaceTeam[],
  allMembersLabel: string,
  otherMembersLabel: string,
) {
  if (teams.length === 0) {
    return [{ value: "all-members", label: allMembersLabel, members }];
  }

  const groupedUserIds = new Set(teams.flatMap((team) => team.userIds));
  const groups: MemberGroup[] = teams
    .map((team) => ({
      value: team.id,
      label: team.name,
      members: members.filter((member) => team.userIds.includes(member.userId)),
    }))
    .filter((group) => group.members.length > 0);
  const otherMembers = members.filter(
    (member) => !groupedUserIds.has(member.userId),
  );

  if (otherMembers.length > 0) {
    groups.push({
      value: "other-members",
      label: otherMembersLabel,
      members: otherMembers,
    });
  }

  return groups;
}
