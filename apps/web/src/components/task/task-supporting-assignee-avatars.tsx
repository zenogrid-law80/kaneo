import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { getInitials } from "@/lib/get-initials";
import type Task from "@/types/task";
import TaskSupportingAssigneesOverflow from "./task-supporting-assignees-overflow";

export default function TaskSupportingAssigneeAvatars({
  task,
  members,
  size = "default",
  display = "avatars",
}: {
  task: Pick<Task, "userId" | "supportingAssignees">;
  members?: Array<{ userId: string; user: { image?: string | null } }>;
  size?: "small" | "default";
  display?: "avatars" | "count";
}) {
  const { t } = useTranslation();
  const people = [
    ...new Map(
      (task.supportingAssignees ?? [])
        .filter((member) => member.userId !== task.userId)
        .map((member) => [member.userId, member]),
    ).values(),
  ];
  if (!people.length) return null;
  const label = t("tasks:supportingAssignees.label");
  const avatarSize = size === "small" ? "h-5 w-5" : "h-6 w-6";
  const description = `${label}: ${people.map((member) => member.name).join(", ")}`;

  if (display === "count") {
    return (
      <span
        role="group"
        aria-label={description}
        title={description}
        className="inline-flex shrink-0"
      >
        <TaskSupportingAssigneesOverflow
          display="count"
          members={people.map((person) => ({
            ...person,
            image: members?.find((member) => member.userId === person.userId)
              ?.user.image,
          }))}
          className="h-6 w-8 rounded-full border border-border/30 bg-muted px-0 text-[10px] font-medium text-muted-foreground"
        />
      </span>
    );
  }

  return (
    <span
      role="group"
      aria-label={description}
      title={description}
      className="inline-flex shrink-0 items-center gap-1"
    >
      {people.slice(0, 3).map((member) => (
        <Avatar
          key={member.userId}
          className={avatarSize}
          role="img"
          aria-label={`${label}: ${member.name}`}
          title={`${label}: ${member.name}`}
        >
          <AvatarImage
            src={
              members?.find((user) => user.userId === member.userId)?.user
                .image ?? ""
            }
            alt=""
          />
          <AvatarFallback className="whitespace-nowrap border border-border/30 text-[10px] font-medium leading-none">
            {getInitials(member.name)}
          </AvatarFallback>
        </Avatar>
      ))}
      {people.length > 3 && (
        <span
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full border border-border/30 bg-muted text-[10px] font-medium leading-none text-muted-foreground",
            avatarSize,
          )}
          title={people
            .slice(3)
            .map((member) => member.name)
            .join(", ")}
        >
          +{people.length - 3}
        </span>
      )}
    </span>
  );
}
