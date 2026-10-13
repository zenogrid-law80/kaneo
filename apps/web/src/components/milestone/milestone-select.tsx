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
import {
  useMilestone,
  useMilestoneOptions,
} from "@/hooks/queries/milestone/use-milestones";

export default function MilestoneSelect({
  projectId,
  value,
  onChange,
  disabled = false,
  includeClosed = false,
  filter = false,
  bulk = false,
}: {
  projectId: string;
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  includeClosed?: boolean;
  filter?: boolean;
  bulk?: boolean;
}) {
  const { t } = useTranslation();
  const query = useMilestoneOptions(projectId);
  const currentQuery = useMilestone(
    projectId,
    !filter && !bulk ? (value ?? undefined) : undefined,
  );
  const current = currentQuery.isError ? undefined : currentQuery.data;
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage)
      void fetchNextPage({ cancelRefetch: false });
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const milestones = query.data?.pages.flatMap((page) => page.data) ?? [];
  if (current && !milestones.some((m) => m.id === current.id))
    milestones.push(current);
  const options = [
    ...(filter
      ? [{ label: t("tasks:milestones.all"), value: "all", disabled: false }]
      : []),
    ...(bulk
      ? [{ label: t("tasks:milestones.bulk"), value: "bulk", disabled: true }]
      : []),
    { label: t("tasks:milestones.none"), value: "none", disabled: false },
    ...milestones
      .filter((m) => includeClosed || m.status === "open" || m.id === value)
      .map((m) => ({
        label:
          m.status === "closed"
            ? t("tasks:milestones.closedName", { name: m.name })
            : m.name,
        value: m.id,
        disabled: !includeClosed && m.status === "closed",
      })),
  ];
  return (
    <div className="min-w-36">
      <Select
        items={options}
        value={value ?? (bulk ? "bulk" : filter ? "all" : "none")}
        onValueChange={(id) =>
          onChange(id === "all" || (!filter && id === "none") ? null : id)
        }
        disabled={disabled || query.isLoading || query.isError}
      >
        <SelectTrigger size="sm" aria-label={t("tasks:milestones.title")}>
          <SelectValue placeholder={t("tasks:milestones.title")} />
        </SelectTrigger>
        <SelectPopup>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
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
