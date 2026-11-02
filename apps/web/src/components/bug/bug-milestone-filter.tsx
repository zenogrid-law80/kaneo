import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMilestoneOptions } from "@/hooks/queries/milestone/use-milestones";
import { useCurrentMilestone } from "@/hooks/queries/milestone/use-current-milestone";
import { CURRENT_MILESTONE_FILTER } from "@/store/milestone-filters";

export default function BugMilestoneFilter({
  projectId,
  value,
  onChange,
}: {
  projectId: string;
  value?: string;
  onChange: (id?: string) => void;
}) {
  const { t } = useTranslation();
  const query = useMilestoneOptions(projectId);
  const current = useCurrentMilestone(projectId);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage)
      void fetchNextPage({ cancelRefetch: false });
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const milestones = query.data?.pages.flatMap((page) => page.data) ?? [];
  const items = [
    ...(current.data
      ? [{ value: CURRENT_MILESTONE_FILTER, label: current.data.name }]
      : []),
    { value: "all", label: t("tasks:milestones.all") },
    { value: "none", label: t("tasks:milestones.none") },
    ...milestones
      .filter((milestone) => milestone.id !== current.data?.id)
      .map((milestone) => ({ value: milestone.id, label: milestone.name })),
  ];
  const selected =
    value === undefined || value === current.data?.id
      ? current.data
        ? CURRENT_MILESTONE_FILTER
        : "all"
      : value;
  // Preserve the active filter while loading or when a milestone was deleted.
  if (!items.some((item) => item.value === selected))
    items.push({ value: selected, label: t("tasks:bugs.selectedMilestone") });
  return (
    <div className="min-w-36 max-w-full">
      <Select
        items={items}
        value={selected}
        onValueChange={(id) => {
          if (id) onChange(id === CURRENT_MILESTONE_FILTER ? undefined : id);
        }}
        disabled={query.isPending || query.isError || current.isPending}
      >
        <SelectTrigger
          size="sm"
          className="max-w-64"
          aria-label={t("tasks:milestones.title")}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectPopup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
      {(query.isError || current.isError) && (
        <Button
          size="xs"
          variant="ghost"
          onClick={() => {
            void query.refetch();
            void current.refetch();
          }}
        >
          {t("tasks:milestones.retry")}
        </Button>
      )}
    </div>
  );
}
