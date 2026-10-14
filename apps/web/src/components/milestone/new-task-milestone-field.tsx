import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useCurrentMilestone } from "@/hooks/queries/milestone/use-current-milestone";
import MilestoneSelect from "./milestone-select";

export default function NewTaskMilestoneField({
  projectId,
  value,
  onChange,
  disabled,
}: {
  projectId: string;
  value: string | null | undefined;
  onChange: (id: string | null | undefined) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const current = useCurrentMilestone(projectId);
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{t("tasks:milestones.title")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <MilestoneSelect
          projectId={projectId}
          value={value === undefined ? (current.data?.id ?? null) : value}
          onChange={onChange}
          disabled={disabled || (value === undefined && current.isPending)}
        />
        {value !== undefined && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onChange(undefined)}
          >
            {t("tasks:milestones.useDefault")}
          </Button>
        )}
      </div>
      {value === undefined && (
        <p className="text-xs text-muted-foreground">
          {t("tasks:milestones.newTaskDefault")}
        </p>
      )}
      {current.isError && (
        <div role="alert" className="text-sm text-destructive">
          {t("tasks:milestones.loadError")}{" "}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void current.refetch()}
          >
            {t("tasks:milestones.retry")}
          </Button>
        </div>
      )}
    </div>
  );
}
