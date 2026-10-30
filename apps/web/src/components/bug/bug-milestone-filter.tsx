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
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage)
      void fetchNextPage({ cancelRefetch: false });
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const milestones = query.data?.pages.flatMap((page) => page.data) ?? [];
  const items = [
    { value: "all", label: t("tasks:milestones.all") },
    { value: "none", label: t("tasks:milestones.none") },
    ...milestones.map((milestone) => ({
      value: milestone.id,
      label: milestone.name,
    })),
  ];
  // Preserve the active filter while loading or when a milestone was deleted.
  if (value && !items.some((item) => item.value === value))
    items.push({ value, label: t("tasks:bugs.selectedMilestone") });
  return (
    <div className="min-w-36 max-w-full">
      <Select
        items={items}
        value={value ?? "all"}
        onValueChange={(id) => onChange(!id || id === "all" ? undefined : id)}
        disabled={query.isPending || query.isError}
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
      {query.isError && (
        <Button size="xs" variant="ghost" onClick={() => void query.refetch()}>
          {t("tasks:milestones.retry")}
        </Button>
      )}
    </div>
  );
}
