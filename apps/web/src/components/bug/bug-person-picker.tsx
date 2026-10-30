import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import AssigneePickerContent from "@/components/task/assignee-picker-content";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import useWorkspaceTeams from "@/hooks/queries/workspace/use-workspace-teams";
import type { Bug } from "@/fetchers/bug";

export default function BugPersonPicker({
  workspaceId,
  label,
  value,
  person,
  disabled,
  onChange,
}: {
  workspaceId: string;
  label: string;
  value: string | null;
  person: Bug["fixer"];
  disabled: boolean;
  onChange: (value: string | null) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const members = useGetActiveWorkspaceUsers(open ? workspaceId : "");
  const teams = useWorkspaceTeams(open ? workspaceId : "");
  const [selectedPerson, setSelectedPerson] = useState<Bug["fixer"]>(null);
  const name = value
    ? ([person, selectedPerson].find((candidate) => candidate?.id === value)
        ?.name ?? t("tasks:bugs.unknownPerson"))
    : t("tasks:bugs.unassigned");
  return (
    <div className="min-w-0 space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <Popover open={open && !disabled} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
            disabled={disabled}
            aria-label={`${label}: ${name}`}
          >
            <span className="truncate">{name}</span>
            <ChevronDown className="size-4 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          {members.isError || teams.isError ? (
            <div role="alert" className="space-y-2 p-3 text-sm">
              <p>{t("tasks:bugs.peopleLoadError")}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void members.refetch();
                  void teams.refetch();
                }}
              >
                {t("tasks:bugs.retry")}
              </Button>
            </div>
          ) : members.isPending || teams.isPending ? (
            <p role="status" className="p-3 text-sm">
              {t("common:empty.loading")}
            </p>
          ) : (
            <AssigneePickerContent
              members={members.data?.members ?? []}
              teams={teams.data ?? []}
              selectedUserId={value}
              unassignedSelected={!value}
              onSelect={(userId) => {
                const member = members.data?.members.find(
                  (item) => item.userId === userId,
                );
                setSelectedPerson(
                  member
                    ? {
                        id: member.userId,
                        name: member.user.name,
                        image: member.user.image ?? null,
                      }
                    : null,
                );
                onChange(userId || null);
                setOpen(false);
              }}
            />
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
