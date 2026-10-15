import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { getInitials } from "@/lib/get-initials";
import type Task from "@/types/task";
import TaskSupportingAssigneeAvatars from "./task-supporting-assignee-avatars";

export default function TaskAssigneeAvatars({
  task,
  members,
  size = "default",
  supportingDisplay = "avatars",
  className,
}: {
  task: Pick<
    Task,
    "userId" | "assigneeName" | "assigneeImage" | "supportingAssignees"
  >;
  members?: Array<{
    userId: string;
    user: { name?: string | null; image?: string | null };
  }>;
  size?: "small" | "default";
  supportingDisplay?: "avatars" | "count";
  className?: string;
}) {
  const { t } = useTranslation();
  const assignee = members?.find((member) => member.userId === task.userId);
  const name =
    assignee?.user.name ?? task.assigneeName ?? t("common:people.someone");
  const label = task.userId
    ? `${t("tasks:supportingAssignees.primaryAssignee")}: ${name}`
    : t("tasks:assignee.unassigned");

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5",
        supportingDisplay === "count" && "w-16",
        className,
      )}
    >
      <Avatar
        className={size === "small" ? "h-5 w-5" : "h-6 w-6"}
        role="img"
        aria-label={label}
        title={label}
      >
        <AvatarImage
          src={assignee?.user.image ?? task.assigneeImage ?? ""}
          alt=""
        />
        <AvatarFallback className="whitespace-nowrap border border-border/30 text-[10px] font-medium leading-none">
          {task.userId ? getInitials(name) : "?"}
        </AvatarFallback>
      </Avatar>
      <TaskSupportingAssigneeAvatars
        task={task}
        members={members}
        size={size}
        display={supportingDisplay}
      />
    </span>
  );
}
