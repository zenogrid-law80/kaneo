import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type Task from "@/types/task";

export default function TaskAssigneeNames({
  task,
  members,
  className,
}: {
  task: Pick<Task, "userId" | "assigneeName" | "supportingAssignees">;
  members?: Array<{ userId: string; user: { name?: string | null } }>;
  className?: string;
}) {
  const { t } = useTranslation();
  const primary = task.userId
    ? (members?.find((member) => member.userId === task.userId)?.user.name ??
      task.assigneeName ??
      t("common:people.someone"))
    : t("tasks:assignee.unassigned");
  const supporting = [
    ...new Map(
      (task.supportingAssignees ?? [])
        .filter((member) => member.userId !== task.userId)
        .map((member) => [member.userId, member]),
    ).values(),
  ];
  const names = [
    primary,
    ...supporting.map(
      (member) =>
        members?.find((user) => user.userId === member.userId)?.user.name ??
        member.name,
    ),
  ].join(", ");

  return (
    <span
      role="group"
      aria-label={names}
      title={names}
      className={cn(
        "min-w-0 truncate text-[11px] leading-4 text-muted-foreground",
        className,
      )}
    >
      {names}
    </span>
  );
}
