import { UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type Task from "@/types/task";

export default function TaskSupportingAssigneesSummary({
  task,
  className,
}: {
  task: Pick<Task, "userId" | "supportingAssignees">;
  className?: string;
}) {
  const { t } = useTranslation();
  const members = [
    ...new Map(
      (task.supportingAssignees ?? [])
        .filter((member) => member.userId !== task.userId)
        .map((member) => [member.userId, member]),
    ).values(),
  ];
  if (!members.length) return null;
  const label = t("tasks:supportingAssignees.label");
  const names = members.map((member) => member.name);
  const description = `${label}: ${names.join(", ")}`;

  return (
    <span
      className={cn(
        "inline-flex min-w-0 max-w-full items-center gap-1 text-[11px] leading-4 text-muted-foreground",
        className,
      )}
      role="group"
      aria-label={description}
      title={description}
    >
      <UsersRound className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">
        {label}: {names.slice(0, 2).join(", ")}
      </span>
      {members.length > 2 && (
        <span className="shrink-0">+{members.length - 2}</span>
      )}
    </span>
  );
}
