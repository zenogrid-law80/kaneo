import { Check, Search, UsersRound } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Command,
  CommandCollection,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandSeparator,
} from "@/components/ui/command";
import type { WorkspaceTeam } from "@/hooks/queries/workspace/use-workspace-teams";
import { getInitials } from "@/lib/get-initials";
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

export default function AssigneePickerContent({
  members,
  teams,
  selectedUserId,
  unassignedSelected,
  onSelect,
}: {
  members: WorkspaceUser[];
  teams: WorkspaceTeam[];
  selectedUserId: string | null;
  unassignedSelected: boolean;
  onSelect: (userId: string) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const groups = useMemo(
    () =>
      groupAssigneeMembers(
        members,
        teams,
        t("tasks:popover.assignee.allMembers"),
        t("tasks:popover.assignee.otherMembers"),
      ),
    [members, teams, t],
  );
  const filteredGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          members: group.members.filter((member) =>
            matchesAssigneeSearch(member.user.name, query),
          ),
        }))
        .filter((group) => group.members.length > 0),
    [groups, query],
  );
  const unassignedLabel = t("tasks:popover.assignee.unassigned");
  const showUnassigned = matchesAssigneeSearch(unassignedLabel, query);
  const hasResults = showUnassigned || filteredGroups.length > 0;

  return (
    <Command items={filteredGroups} mode="none">
      <CommandInput
        placeholder={t("tasks:popover.assignee.searchPlaceholder")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <CommandPanel>
        {!hasResults && (
          <div className="py-6 text-center">
            <Search className="mx-auto mb-2 size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {t("tasks:popover.assignee.noMembersFound")}
            </p>
          </div>
        )}
        {hasResults && (
          <CommandList className="max-h-80">
            {showUnassigned && (
              <CommandGroup
                items={[{ value: "unassigned", label: unassignedLabel }]}
              >
                <CommandCollection>
                  {() => (
                    <CommandItem
                      value={unassignedLabel}
                      onClick={() => onSelect("")}
                      className="gap-2 px-2"
                    >
                      <span className="flex size-6 items-center justify-center rounded-full border bg-muted text-[10px] font-medium text-muted-foreground">
                        ?
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {unassignedLabel}
                      </span>
                      {unassignedSelected && <Check className="size-4" />}
                    </CommandItem>
                  )}
                </CommandCollection>
              </CommandGroup>
            )}
            {filteredGroups.map((group, index) => (
              <Fragment key={group.value}>
                {(showUnassigned || index > 0) && <CommandSeparator />}
                <CommandGroup items={group.members}>
                  <CommandGroupLabel className="flex items-center gap-1.5">
                    <UsersRound className="size-3.5" />
                    {group.label}
                  </CommandGroupLabel>
                  <CommandCollection>
                    {(member: WorkspaceUser) => (
                      <CommandItem
                        key={`${group.value}-${member.userId}`}
                        value={`${member.user.name} ${member.user.email}`}
                        onClick={() => onSelect(member.userId)}
                        className="flex items-start gap-3 px-3 py-3"
                      >
                        <Avatar className="mt-0.5 size-7 shrink-0">
                          <AvatarImage
                            src={member.user.image ?? ""}
                            alt={member.user.name}
                          />
                          <AvatarFallback className="text-xs">
                            {getInitials(member.user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {member.user.name}
                          </div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            {member.user.email}
                          </div>
                        </div>
                        {selectedUserId === member.userId && (
                          <Check className="size-4" />
                        )}
                      </CommandItem>
                    )}
                  </CommandCollection>
                </CommandGroup>
              </Fragment>
            ))}
          </CommandList>
        )}
      </CommandPanel>
    </Command>
  );
}
