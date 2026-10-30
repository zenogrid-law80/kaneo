import { Filter } from "lucide-react";
import { useTranslation } from "react-i18next";
import AssigneeFilterItems from "@/components/project-task-filters/assignee-filter-items";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import useWorkspaceTeams from "@/hooks/queries/workspace/use-workspace-teams";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import type { BugSearch } from "./bug-search";
import BugMilestoneFilter from "./bug-milestone-filter";
import BugViewSwitch from "./bug-view-switch";

const roles = [
  { key: "reporterId", label: "tasks:bugs.reporter" },
  { key: "fixerId", label: "tasks:bugs.fixer" },
  { key: "verifierId", label: "tasks:bugs.verifier" },
] as const;

export default function BugFilters({
  workspaceId,
  projectId,
  search,
  onChange,
}: {
  workspaceId: string;
  projectId: string;
  search: BugSearch;
  onChange: (search: Partial<BugSearch>) => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const members = useGetActiveWorkspaceUsers(workspaceId);
  const teams = useWorkspaceTeams(workspaceId);
  const activeRoles = roles.filter(({ key }) => search[key]);
  const activeFilterCount = activeRoles.length;
  const selectedIds = activeRoles[0]
    ? (search[activeRoles[0].key]?.split(",") ?? [])
    : [];
  const selectedMember = members.data?.members.find(
    (member) => member.userId === selectedIds[0],
  );
  const filterLabel =
    activeFilterCount === 0
      ? t("tasks:hierarchy.filters.all")
      : activeFilterCount > 1
        ? t("tasks:hierarchy.filters.selected", { count: activeFilterCount })
        : selectedIds.length > 1
          ? t("tasks:boardFilters.selectedCount", {
              count: selectedIds.length,
            })
          : selectedIds[0] === "none"
            ? t("tasks:hierarchy.filters.unassigned")
            : (selectedMember?.user.name ??
              t("tasks:hierarchy.filters.assignee"));

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <BugMilestoneFilter
          projectId={projectId}
          value={search.milestoneId}
          onChange={(milestoneId) => onChange({ milestoneId })}
        />
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t("common:actions.filter")}
            render={
              <Button
                variant={activeFilterCount === 0 ? "outline" : "secondary"}
                size="sm"
                className="h-7 gap-1.5 rounded-md px-2.5 text-xs"
              />
            }
          >
            <Filter className="size-3.5" />
            {filterLabel}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[11px] uppercase tracking-wide">
                {t("tasks:boardFilters.filterBy")}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {roles.map(({ key, label }) => (
                <DropdownMenuSub key={key}>
                  <DropdownMenuSubTrigger className="h-8 rounded-md text-sm">
                    <span>{t(label)}</span>
                    {search[key] && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {search[key].split(",").length}
                      </span>
                    )}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-64">
                    {members.isError || teams.isError ? (
                      <DropdownMenuItem
                        onClick={() => {
                          void members.refetch();
                          void teams.refetch();
                        }}
                      >
                        {t("tasks:bugs.peopleLoadError")} ·{" "}
                        {t("tasks:bugs.retry")}
                      </DropdownMenuItem>
                    ) : members.isPending || teams.isPending ? (
                      <DropdownMenuItem disabled>
                        {t("common:empty.loading")}
                      </DropdownMenuItem>
                    ) : (
                      <AssigneeFilterItems
                        members={members.data?.members ?? []}
                        teams={teams.data ?? []}
                        user={user}
                        selectedIds={search[key]?.split(",") ?? []}
                        unassignedValue="none"
                        onChange={(ids) =>
                          onChange({ [key]: ids.join(",") || undefined })
                        }
                      />
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))}
            </DropdownMenuGroup>
            {(activeFilterCount > 0 || search.milestoneId) && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    onChange({
                      reporterId: undefined,
                      fixerId: undefined,
                      verifierId: undefined,
                      milestoneId: undefined,
                    })
                  }
                >
                  {t("common:actions.clearAllFilters")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <BugViewSwitch search={search} onChange={onChange} />
    </div>
  );
}
