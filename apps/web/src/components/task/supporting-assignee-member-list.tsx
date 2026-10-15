import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { getInitials } from "@/lib/get-initials";
import type WorkspaceUser from "@/types/workspace-user";

export default function SupportingAssigneeMemberList({
  members,
  primaryAssigneeId,
  selectedUserIds,
  disabled,
  onChange,
}: {
  members: WorkspaceUser[];
  primaryAssigneeId: string | null;
  selectedUserIds: string[];
  disabled: boolean;
  onChange: (userId: string, assigned: boolean) => void;
}) {
  const { t } = useTranslation();
  return members.map((member) => (
    <label
      key={member.userId}
      className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-2 hover:bg-accent has-[[data-disabled]]:cursor-not-allowed has-[[data-disabled]]:opacity-50"
    >
      <Checkbox
        checked={
          member.userId !== primaryAssigneeId &&
          selectedUserIds.includes(member.userId)
        }
        disabled={disabled || member.userId === primaryAssigneeId}
        onCheckedChange={(assigned) => {
          if (member.userId !== primaryAssigneeId)
            onChange(member.userId, assigned);
        }}
      />
      <Avatar className="size-6" aria-hidden="true">
        <AvatarImage src={member.user.image ?? ""} alt="" />
        <AvatarFallback className="text-xs">
          {getInitials(member.user.name)}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 truncate text-sm">{member.user.name}</span>{" "}
      {member.userId === primaryAssigneeId && (
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          {t("tasks:supportingAssignees.primaryAssignee")}
        </span>
      )}
    </label>
  ));
}
