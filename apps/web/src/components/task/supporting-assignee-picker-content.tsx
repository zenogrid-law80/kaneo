import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { ChevronRight, UsersRound } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { WorkspaceTeam } from "@/hooks/queries/workspace/use-workspace-teams";
import type WorkspaceUser from "@/types/workspace-user";
import {
  groupAssigneeMembers,
  matchesAssigneeSearch,
} from "./assignee-picker-model";
import SupportingAssigneeMemberList from "./supporting-assignee-member-list";

export default function SupportingAssigneePickerContent({
  members,
  primaryAssigneeId,
  teams,
  selectedUserIds,
  disabled,
  onChange,
}: {
  members: WorkspaceUser[];
  primaryAssigneeId: string | null;
  teams: WorkspaceTeam[];
  selectedUserIds: string[];
  disabled: boolean;
  onChange: (userId: string, assigned: boolean) => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const currentMember = members.find((member) => member.userId === user?.id);
  const [search, setSearch] = useState("");
  const groups = groupAssigneeMembers(
    members,
    teams,
    t("tasks:popover.assignee.allMembers"),
    t("tasks:popover.assignee.otherMembers"),
  );
  const isSearching = search.trim().length > 0;
  const matches = members.filter((member) =>
    matchesAssigneeSearch(member.user.name, search),
  );
  const showCurrentMember =
    currentMember && matchesAssigneeSearch(currentMember.user.name, search);
  const selection = { primaryAssigneeId, selectedUserIds, disabled, onChange };

  return (
    <div className="space-y-2">
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t("tasks:supportingAssignees.search")}
        aria-label={t("tasks:supportingAssignees.search")}
      />
      <div
        className="max-h-72 space-y-1 overflow-y-auto"
        role="group"
        aria-label={t("tasks:supportingAssignees.label")}
        aria-busy={disabled}
      >
        {(isSearching
          ? matches.length === 0
          : groups.length === 0 || members.length === 0) && (
          <p className="py-3 text-center text-xs text-muted-foreground">
            {t("tasks:supportingAssignees.empty")}
          </p>
        )}
        {showCurrentMember && (
          <div className="border-b pb-1">
            <SupportingAssigneeMemberList
              members={[currentMember]}
              {...selection}
            />
          </div>
        )}
        {isSearching ? (
          <SupportingAssigneeMemberList
            members={matches.filter(
              (member) => member.userId !== currentMember?.userId,
            )}
            {...selection}
          />
        ) : (
          groups
            .filter((group) => group.members.length > 0)
            .map((group) => (
              <Popover key={group.value}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 w-full justify-start gap-2 rounded-sm px-2 font-normal"
                  >
                    <UsersRound className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-left">
                      {group.label}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  side="right"
                  align="start"
                  sideOffset={6}
                  className="w-72 p-1"
                  aria-label={group.label}
                >
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    {group.label}
                  </div>
                  <div
                    className="max-h-72 overflow-y-auto"
                    role="group"
                    aria-label={group.label}
                    aria-busy={disabled}
                  >
                    <SupportingAssigneeMemberList
                      members={group.members}
                      {...selection}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            ))
        )}
      </div>
    </div>
  );
}
