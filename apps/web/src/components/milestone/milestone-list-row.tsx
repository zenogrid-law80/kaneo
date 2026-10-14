import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Radio } from "@/components/ui/radio-group";
import type { Milestone } from "@/fetchers/milestone";
import { isMilestoneOverdue } from "@/lib/milestone-date";

export default function MilestoneListRow({
  milestone,
  today,
  selectable,
  onSelect,
}: {
  milestone: Milestone;
  today: string;
  selectable: boolean;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 px-4 transition-colors hover:bg-accent">
      {selectable && (
        <Radio
          value={milestone.id}
          aria-label={milestone.name}
          disabled={milestone.status !== "open"}
        />
      )}
      <button
        type="button"
        aria-label={milestone.name}
        className="flex min-w-0 flex-1 flex-wrap items-center gap-4 rounded-sm py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => onSelect(milestone.id)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{milestone.name}</p>
            {milestone.isCurrent && (
              <Badge variant="secondary">{t("tasks:milestones.current")}</Badge>
            )}
          </div>
          <p
            className={`mt-1 text-xs ${isMilestoneOverdue(milestone, today) ? "text-destructive" : "text-muted-foreground"}`}
          >
            {milestone.dueDate ?? t("tasks:milestones.noDate")}
            {isMilestoneOverdue(milestone, today) &&
              ` · ${t("tasks:milestones.overdue")}`}
          </p>
        </div>
        <div className="w-44 space-y-1 text-xs">
          <p>
            {milestone.totalTasks
              ? t("tasks:milestones.progress", {
                  completed: milestone.completedTasks,
                  total: milestone.totalTasks,
                })
              : t("tasks:milestones.noTasks")}
          </p>
          <progress
            className="h-1.5 w-full accent-primary"
            value={milestone.progressPercent}
            max={100}
            aria-label={t("tasks:milestones.progressLabel")}
          />
        </div>
      </button>
    </div>
  );
}
