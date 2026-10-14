import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Radio, RadioGroup } from "@/components/ui/radio-group";
import type { Milestone } from "@/fetchers/milestone";
import { useMilestoneMutations } from "@/hooks/mutations/milestone/use-milestone-mutations";
import { useCurrentMilestone } from "@/hooks/queries/milestone/use-current-milestone";
import MilestoneListRow from "./milestone-list-row";

export default function MilestoneList({
  projectId,
  milestones,
  today,
  canManage,
  status,
  onSelect,
}: {
  projectId: string;
  milestones: Milestone[];
  today: string;
  canManage: boolean;
  status: "open" | "closed";
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const selectable = canManage && status === "open";
  const current = useCurrentMilestone(projectId, selectable);
  const { update } = useMilestoneMutations(projectId);
  const [error, setError] = useState<string>();
  const disabled =
    update.isPending ||
    current.isPending ||
    current.isFetching ||
    current.isError;
  const rows = milestones.map((milestone) => (
    <MilestoneListRow
      key={milestone.id}
      milestone={milestone}
      today={today}
      selectable={selectable}
      onSelect={onSelect}
    />
  ));
  if (!selectable)
    return <div className="divide-y rounded-lg border">{rows}</div>;
  return (
    <div className="space-y-2">
      <RadioGroup
        aria-label={t("tasks:milestones.setCurrent")}
        aria-busy={update.isPending || current.isFetching}
        className="gap-0 overflow-hidden rounded-lg border"
        value={current.data?.id ?? "none"}
        disabled={disabled}
        onValueChange={async (value) => {
          if (
            disabled ||
            typeof value !== "string" ||
            value === current.data?.id
          )
            return;
          const id = value === "none" ? current.data?.id : value;
          if (!id) return;
          setError(undefined);
          try {
            await update.mutateAsync({
              id,
              input: { isCurrent: value !== "none" },
            });
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : t("tasks:milestones.saveError"),
            );
          }
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
          <span className="text-sm font-medium">
            {t("tasks:milestones.currentSelection", {
              name: current.data?.name ?? t("tasks:milestones.noCurrent"),
            })}
          </span>
          <label className="flex items-center gap-2 text-sm">
            <Radio value="none" />
            {t("tasks:milestones.noCurrent")}
          </label>
        </div>
        <div className="divide-y">{rows}</div>
      </RadioGroup>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {current.isError && (
        <div
          role="alert"
          className="flex items-center gap-2 text-sm text-destructive"
        >
          {t("tasks:milestones.loadError")}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void current.refetch()}
          >
            {t("tasks:milestones.retry")}
          </Button>
        </div>
      )}
    </div>
  );
}
