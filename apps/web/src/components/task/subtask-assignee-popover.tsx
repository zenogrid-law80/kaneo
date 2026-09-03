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

type SubtaskAssigneePopoverProps = {
  tasks: Task[];
  workspaceId: string;
  children: React.ReactNode;
};

export default function SubtaskAssigneePopover({
  tasks,
  workspaceId,
  children,
}: SubtaskAssigneePopoverProps) {
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

  const allSameAssignee =
    tasks.length > 0 && tasks.every((t) => t.userId === tasks[0].userId);
  const currentAssignee = allSameAssignee ? tasks[0].userId : null;

  const handleAssigneeChange = useCallback(
    async (newUserId: string) => {
      try {
        await Promise.all(
          tasks.map((task) =>
            updateTaskAssignee({
              ...task,
              userId: newUserId,
            }),
          ),
        );
        setOpen(false);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("tasks:popover.assignee.updateError"),
        );
      }
    },
    [t, tasks, updateTaskAssignee],
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
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <AssigneePickerContent
          members={workspaceUsers?.members ?? []}
          teams={teams}
          selectedUserId={currentAssignee ?? null}
          unassignedSelected={allSameAssignee && !currentAssignee}
          onSelect={(userId) => void handleAssigneeChange(userId)}
        />
      </PopoverContent>
    </Popover>
  );
}
