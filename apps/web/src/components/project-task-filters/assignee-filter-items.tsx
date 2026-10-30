import { UserRoundX, UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/menu";
import type { WorkspaceTeam } from "@/hooks/queries/workspace/use-workspace-teams";
import AssigneeFilterPerson from "./assignee-filter-person";

export default function AssigneeFilterItems({
  members,
  teams,
  user,
  selectedIds,
  onChange,
  unassignedValue,
}: {
  members: Array<{
    userId: string;
    user?: {
      name?: string | null;
      image?: string | null;
      email?: string;
    } | null;
  }>;
  teams: WorkspaceTeam[];
  user: { id: string; name: string; image?: string | null } | null | undefined;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  unassignedValue: string;
}) {
  const { t } = useTranslation();
  const toggleAssigneeFilter = (id: string) =>
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((value) => value !== id)
        : [...selectedIds, id],
    );
  const toggleTeamMembers = (ids: string[]) => {
    if (ids.length === 0) return;
    onChange(
      ids.every((id) => selectedIds.includes(id))
        ? selectedIds.filter((id) => !ids.includes(id))
        : [...new Set([...selectedIds, ...ids])],
    );
  };
  return (
    <div className="grid grid-cols-1 gap-1 p-1">
      <DropdownMenuCheckboxItem
        className="h-7 rounded-md text-xs sm:text-xs data-checked:bg-accent data-checked:text-accent-foreground"
        checked={selectedIds.length === 0}
        indicatorVariant="checkbox"
        closeOnClick={false}
        onCheckedChange={() => onChange([])}
      >
        {t("tasks:boardFilters.allAssignees")}
      </DropdownMenuCheckboxItem>
      {user && (
        <DropdownMenuCheckboxItem
          className="h-7 rounded-md text-xs sm:text-xs data-checked:bg-accent data-checked:text-accent-foreground"
          checked={selectedIds.includes(user.id)}
          indicatorVariant="checkbox"
          closeOnClick={false}
          onCheckedChange={() => toggleAssigneeFilter(user.id)}
        >
          <AssigneeFilterPerson name={user.name} image={user.image} />
        </DropdownMenuCheckboxItem>
      )}
      <DropdownMenuCheckboxItem
        className="h-7 rounded-md text-xs sm:text-xs data-checked:bg-accent data-checked:text-accent-foreground"
        checked={selectedIds.includes(unassignedValue)}
        indicatorVariant="checkbox"
        closeOnClick={false}
        onCheckedChange={() => toggleAssigneeFilter(unassignedValue)}
      >
        <span className="flex items-center gap-2">
          <UserRoundX className="size-4 text-muted-foreground" />
          {t("tasks:boardFilters.unassigned")}
        </span>
      </DropdownMenuCheckboxItem>
      <DropdownMenuSeparator />
      {teams.map((team) => {
        const teamMembers = members.filter((member) =>
          team.userIds.includes(member.userId),
        );
        const teamUserIds = teamMembers.map((member) => member.userId);
        return (
          <DropdownMenuSub key={team.id}>
            <DropdownMenuSubTrigger className="h-7 rounded-md text-xs">
              <UsersRound className="size-4 text-muted-foreground" />
              <span className="truncate">{team.name}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-64">
              {teamMembers.length > 0 ? (
                <>
                  <DropdownMenuCheckboxItem
                    className="h-7 rounded-md text-xs sm:text-xs data-checked:bg-accent data-checked:text-accent-foreground"
                    checked={teamUserIds.every((userId) =>
                      selectedIds.includes(userId),
                    )}
                    indicatorVariant="checkbox"
                    closeOnClick={false}
                    onCheckedChange={() => toggleTeamMembers(teamUserIds)}
                  >
                    <span className="flex items-center gap-2">
                      <UsersRound className="size-4 text-muted-foreground" />
                      {t("tasks:boardFilters.allTeamMembers")}
                    </span>
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  {teamMembers.map((member) => (
                    <DropdownMenuCheckboxItem
                      className="h-7 rounded-md text-xs sm:text-xs data-checked:bg-accent data-checked:text-accent-foreground"
                      key={member.userId}
                      checked={selectedIds.includes(member.userId)}
                      indicatorVariant="checkbox"
                      closeOnClick={false}
                      onCheckedChange={() =>
                        toggleAssigneeFilter(member.userId)
                      }
                    >
                      <AssigneeFilterPerson
                        name={member.user?.name ?? member.user?.email}
                        image={member.user?.image}
                      />
                    </DropdownMenuCheckboxItem>
                  ))}
                </>
              ) : (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  {t("tasks:boardFilters.noTeamMembers")}
                </div>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        );
      })}
      {teams.length === 0 && (
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          {t("tasks:boardFilters.noTeams")}
        </div>
      )}
    </div>
  );
}
