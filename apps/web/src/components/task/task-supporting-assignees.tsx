import { UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import useClearTaskSupportingAssignees from "@/hooks/mutations/task/use-clear-task-supporting-assignees";
import useSetTaskSupportingAssignee from "@/hooks/mutations/task/use-set-task-supporting-assignee";
import useTaskSupportingAssignees from "@/hooks/queries/task/use-task-supporting-assignees";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import useWorkspaceTeams from "@/hooks/queries/workspace/use-workspace-teams";
import TaskSupportingAssigneesOverflow from "./task-supporting-assignees-overflow";
import SupportingAssigneePickerContent from "./supporting-assignee-picker-content";

export default function TaskSupportingAssignees({
  taskId,
  projectId,
  workspaceId,
  primaryAssigneeId,
}: {
  taskId: string;
  projectId: string;
  workspaceId: string;
  primaryAssigneeId: string | null;
}) {
  const { t } = useTranslation();
  const query = useTaskSupportingAssignees(taskId, projectId);
  const users = useGetActiveWorkspaceUsers(workspaceId);
  const teams = useWorkspaceTeams(workspaceId);
  const mutation = useSetTaskSupportingAssignee(projectId);
  const clearMutation = useClearTaskSupportingAssignees(projectId);
  const isBusy =
    mutation.isPending || clearMutation.isPending || query.isFetching;
  const { canAssignTasks } = useWorkspacePermission();
  const selected = (query.data ?? []).filter(
    (member) => member.userId !== primaryAssigneeId,
  );
  const label = t("tasks:supportingAssignees.label");
  const firstName = selected[0]?.name;

  if (query.isError)
    return (
      <div className="px-1.5 py-1 text-xs" role="alert">
        {t("tasks:supportingAssignees.loadError")}
        <Button size="xs" variant="ghost" onClick={() => void query.refetch()}>
          {t("common:error.tryAgain")}
        </Button>
      </div>
    );

  const content = (
    <>
      <UsersRound className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate text-left">
        {query.isLoading
          ? t("common:empty.loading")
          : firstName || t("tasks:supportingAssignees.none")}
      </span>
    </>
  );
  if (!canAssignTasks())
    return (
      <div className="flex min-w-0 max-w-full items-center gap-0.5">
        <div className="flex min-w-0 items-center gap-1.5 px-1.5 py-1 text-xs">
          {content}
        </div>
        <TaskSupportingAssigneesOverflow members={selected} />
      </div>
    );

  return (
    <div className="flex min-w-0 max-w-full items-center gap-0.5">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="min-h-7 min-w-0 max-w-full justify-start gap-1.5 px-1.5 py-1 text-xs"
            disabled={query.isLoading}
            aria-label={label}
          >
            {content}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-2" align="start" aria-label={label}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mb-2 w-full justify-start"
            disabled={isBusy || selected.length === 0}
            onClick={() =>
              clearMutation.mutate(
                { taskId },
                {
                  onError: () =>
                    toast.error(t("tasks:supportingAssignees.updateError")),
                },
              )
            }
          >
            {t("tasks:supportingAssignees.clearAll")}
          </Button>
          {users.isLoading || teams.isLoading ? (
            <p className="text-xs text-muted-foreground" role="status">
              {t("common:empty.loading")}
            </p>
          ) : users.isError || teams.isError ? (
            <div role="alert" className="text-xs">
              {t("tasks:supportingAssignees.loadError")}
              <Button
                size="xs"
                variant="ghost"
                onClick={() => {
                  if (users.isError) void users.refetch();
                  if (teams.isError) void teams.refetch();
                }}
              >
                {t("common:error.tryAgain")}
              </Button>
            </div>
          ) : (
            <SupportingAssigneePickerContent
              primaryAssigneeId={primaryAssigneeId}
              members={users.data?.members ?? []}
              teams={teams.data ?? []}
              selectedUserIds={selected.map((member) => member.userId)}
              disabled={isBusy}
              onChange={(userId, assigned) =>
                mutation.mutate(
                  { taskId, userId, assigned },
                  {
                    onError: () =>
                      toast.error(t("tasks:supportingAssignees.updateError")),
                  },
                )
              }
            />
          )}
        </PopoverContent>
      </Popover>
      <TaskSupportingAssigneesOverflow members={selected} />
    </div>
  );
}
