import { Filter, UserRoundX, UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import labelColors from "@/constants/label-colors";
import useGetLabelsByWorkspace from "@/hooks/queries/label/use-get-labels-by-workspace";
import useWorkspaceTeams from "@/hooks/queries/workspace/use-workspace-teams";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import {
  DUE_DATE_FILTER_VALUES,
  UNASSIGNED_FILTER_VALUE,
} from "@/hooks/use-task-filters";
import type { ProjectWithTasks } from "@/types/project";
import type { DueDateFilter } from "./types";
import type { useProjectTaskFilters } from "./use-project-task-filters";

export default function ProjectTaskFilters({
  project,
  workspaceId,
  filters,
}: {
  project: ProjectWithTasks | null | undefined;
  workspaceId: string;
  filters: ReturnType<typeof useProjectTaskFilters>;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(workspaceId);
  const { data: workspaceTeams = [] } = useWorkspaceTeams(workspaceId);
  const { data: workspaceLabels = [] } = useGetLabelsByWorkspace(workspaceId);
  const {
    statusFilters,
    setStatusFilters,
    assigneeFilters,
    setAssigneeFilters,
    dueDateFilter,
    setDueDateFilter,
    labelFilters,
    setLabelFilters,
    activeFilterCount,
  } = filters;
  const statusOptions = [
    { slug: "planned", name: t("tasks:status.planned") },
    ...(project?.columns ?? []),
  ];
  const selectedAssignee = workspaceUsers?.members?.find(
    (member) => member.userId === assigneeFilters[0],
  );
  const toggleAssigneeFilter = (userId: string) => {
    setAssigneeFilters((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  };
  const toggleTeamMembers = (userIds: string[]) => {
    if (userIds.length === 0) return;
    setAssigneeFilters((current) => {
      const allSelected = userIds.every((userId) => current.includes(userId));
      return allSelected
        ? current.filter((userId) => !userIds.includes(userId))
        : [...new Set([...current, ...userIds])];
    });
  };
  const filterLabel =
    activeFilterCount === 0
      ? t("tasks:hierarchy.filters.all")
      : activeFilterCount === 1
        ? statusFilters.length > 0
          ? statusFilters.length === 1
            ? (statusOptions.find((status) => status.slug === statusFilters[0])
                ?.name ?? t("tasks:status.label"))
            : t("tasks:boardFilters.selectedCount", {
                count: statusFilters.length,
              })
          : assigneeFilters.length === 1 &&
              assigneeFilters[0] === UNASSIGNED_FILTER_VALUE
            ? t("tasks:hierarchy.filters.unassigned")
            : assigneeFilters.length > 0
              ? assigneeFilters.length === 1
                ? (selectedAssignee?.user?.name ??
                  t("tasks:hierarchy.filters.assignee"))
                : t("tasks:boardFilters.selectedCount", {
                    count: assigneeFilters.length,
                  })
              : dueDateFilter !== "all"
                ? t(`tasks:hierarchy.filters.${dueDateFilter}`)
                : t("tasks:hierarchy.filters.labels")
        : t("tasks:hierarchy.filters.selected", {
            count: activeFilterCount,
          });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("common:actions.filter")}
        render={
          <Button
            variant={activeFilterCount === 0 ? "outline" : "secondary"}
            size="sm"
            className="h-7 gap-1.5 px-2.5 text-xs"
          />
        }
      >
        <Filter className="size-3.5" />
        {filterLabel}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("tasks:status.label")}</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setStatusFilters([])}>
            {t("tasks:boardFilters.allStatuses")}
          </DropdownMenuItem>
          {statusOptions.map((status) => (
            <DropdownMenuCheckboxItem
              key={status.slug}
              checked={statusFilters.includes(status.slug)}
              indicatorVariant="checkbox"
              closeOnClick={false}
              onCheckedChange={() =>
                setStatusFilters((current) =>
                  current.includes(status.slug)
                    ? current.filter((slug) => slug !== status.slug)
                    : [...current, status.slug],
                )
              }
            >
              {status.name}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            {t("tasks:hierarchy.filters.assignee")}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => setAssigneeFilters([])}>
            {t("tasks:hierarchy.filters.allAssignees")}
          </DropdownMenuItem>
          {user && (
            <DropdownMenuCheckboxItem
              checked={assigneeFilters.includes(user.id)}
              indicatorVariant="checkbox"
              onCheckedChange={() => toggleAssigneeFilter(user.id)}
            >
              {user.name}
            </DropdownMenuCheckboxItem>
          )}
          <DropdownMenuCheckboxItem
            checked={assigneeFilters.includes(UNASSIGNED_FILTER_VALUE)}
            indicatorVariant="checkbox"
            onCheckedChange={() =>
              toggleAssigneeFilter(UNASSIGNED_FILTER_VALUE)
            }
          >
            <UserRoundX className="size-4 text-muted-foreground" />
            {t("tasks:hierarchy.filters.unassigned")}
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          {workspaceTeams.map((team) => {
            const teamMembers = (workspaceUsers?.members ?? []).filter(
              (member) => team.userIds.includes(member.userId),
            );
            const teamUserIds = teamMembers.map((member) => member.userId);
            return (
              <DropdownMenuSub key={team.id}>
                <DropdownMenuSubTrigger>
                  <UsersRound className="size-4 text-muted-foreground" />
                  <span className="truncate">{team.name}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-64">
                  {teamMembers.length > 0 ? (
                    <>
                      <DropdownMenuCheckboxItem
                        checked={teamUserIds.every((userId) =>
                          assigneeFilters.includes(userId),
                        )}
                        indicatorVariant="checkbox"
                        onCheckedChange={() => toggleTeamMembers(teamUserIds)}
                      >
                        <UsersRound className="size-4 text-muted-foreground" />
                        {t("tasks:boardFilters.allTeamMembers")}
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuSeparator />
                      {teamMembers.map((member) => (
                        <DropdownMenuCheckboxItem
                          key={member.userId}
                          checked={assigneeFilters.includes(member.userId)}
                          indicatorVariant="checkbox"
                          onCheckedChange={() =>
                            toggleAssigneeFilter(member.userId)
                          }
                        >
                          {member.user?.name ?? member.user?.email}
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
          {workspaceTeams.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              {t("tasks:boardFilters.noTeams")}
            </div>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            {t("tasks:hierarchy.filters.dueDate")}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={dueDateFilter}
          onValueChange={(value) => setDueDateFilter(value as DueDateFilter)}
        >
          <DropdownMenuRadioItem value="all">
            {t("tasks:hierarchy.filters.allDueDates")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value={DUE_DATE_FILTER_VALUES.dueThisWeek}>
            {t("tasks:hierarchy.filters.dueThisWeek")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value={DUE_DATE_FILTER_VALUES.dueNextWeek}>
            {t("tasks:hierarchy.filters.dueNextWeek")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value={DUE_DATE_FILTER_VALUES.noDueDate}>
            {t("tasks:hierarchy.filters.noDueDate")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            {t("tasks:hierarchy.filters.labels")}
          </DropdownMenuLabel>
          {workspaceLabels.map((label) => (
            <DropdownMenuCheckboxItem
              key={label.id}
              checked={labelFilters.includes(label.id)}
              onCheckedChange={() =>
                setLabelFilters((current) =>
                  current.includes(label.id)
                    ? current.filter((id) => id !== label.id)
                    : [...current, label.id],
                )
              }
            >
              <span
                className="size-2.5 rounded-full"
                style={{
                  backgroundColor:
                    labelColors.find((color) => color.value === label.color)
                      ?.color ?? "var(--color-stone-500)",
                }}
              />
              {label.name}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
        {activeFilterCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                setStatusFilters([]);
                setAssigneeFilters([]);
                setDueDateFilter("all");
                setLabelFilters([]);
              }}
            >
              {t("common:actions.clearAllFilters")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
