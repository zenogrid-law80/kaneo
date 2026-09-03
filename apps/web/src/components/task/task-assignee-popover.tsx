import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateTaskAssignee } from "@/hooks/mutations/task/use-update-task-assignee";
import useWorkspaceTeams from "@/hooks/queries/workspace/use-workspace-teams";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { useNumberedShortcuts } from "@/hooks/use-numbered-shortcuts";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";
import AssigneePickerContent from "./assignee-picker-content";

type TaskAssigneePopoverProps = {
  task: Task;
  workspaceId: string;
  children: React.ReactNode;
};

export default function TaskAssigneePopover({
  task,
  workspaceId,
  children,
}: TaskAssigneePopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { mutateAsync: updateTaskAssignee } = useUpdateTaskAssignee();
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(workspaceId);
  const { data: teams = [] } = useWorkspaceTeams(workspaceId);
  const { canAssignTasks } = useWorkspacePermission();
  const canAssign = canAssignTasks();

  const usersOptions = useMemo(() => {
    return workspaceUsers?.members?.map((member) => ({
      label: member?.user?.name ?? member.userId,
      value: member.userId,
      image: member?.user?.image ?? "",
      name: member?.user?.name ?? "",
    }));
  }, [workspaceUsers]);

  const handleAssigneeChange = useCallback(
    async (newUserId: string) => {
      try {
        await updateTaskAssignee({
          ...task,
          userId: newUserId,
        });
        setOpen(false);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("tasks:popover.assignee.updateError"),
        );
      }
    },
    [t, task, updateTaskAssignee],
  );

  const shortcutOptions = useMemo(() => {
    const unassignedOption = { onSelect: () => handleAssigneeChange("") };
    const userOptions = (usersOptions || []).slice(0, 8).map((user) => ({
      onSelect: () => handleAssigneeChange(user.value),
    }));
    return [unassignedOption, ...userOptions];
  }, [usersOptions, handleAssigneeChange]);

  useNumberedShortcuts(open, shortcutOptions);

  if (!canAssign) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <AssigneePickerContent
          members={workspaceUsers?.members ?? []}
          teams={teams}
          selectedUserId={task.userId ?? null}
          unassignedSelected={!task.userId}
          onSelect={(userId) => void handleAssigneeChange(userId)}
        />
      </PopoverContent>
    </Popover>
  );
}
