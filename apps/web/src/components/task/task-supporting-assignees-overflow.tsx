import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import { getInitials } from "@/lib/get-initials";

export default function TaskSupportingAssigneesOverflow({
  members,
  display = "remaining",
  className,
}: {
  members: Array<{ userId: string; name: string; image?: string | null }>;
  display?: "remaining" | "count";
  className?: string;
}) {
  const { t } = useTranslation();
  if (members.length < (display === "count" ? 1 : 2)) return null;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className={cn("shrink-0 px-1.5 tabular-nums", className)}
          />
        }
        aria-label={t("tasks:supportingAssignees.viewAll", {
          count: members.length,
        })}
      >
        +{members.length - (display === "count" ? 0 : 1)}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 max-w-[calc(100vw-2rem)] p-2"
      >
        <PopoverTitle className="px-1 py-2 text-sm">
          {t("tasks:supportingAssignees.label")}
        </PopoverTitle>
        <ul className="max-h-64 overflow-y-auto">
          {members.map((member) => (
            <li
              key={member.userId}
              className="flex items-center gap-2 rounded-md px-1 py-2"
            >
              <Avatar className="size-6 shrink-0" aria-hidden="true">
                <AvatarImage src={member.image ?? ""} alt="" />
                <AvatarFallback className="text-xs">
                  {getInitials(member.name)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 break-words text-sm">{member.name}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
