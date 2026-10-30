import { useDroppable } from "@dnd-kit/core";
import BugCard from "./bug-card";
import BugPagination from "./bug-pagination";
import { cn } from "@/lib/cn";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { BugStatus, BugFilters } from "@/fetchers/bug";
import { useBugs } from "@/hooks/queries/bug/use-bugs";
import { bugStatusKeys } from "./bug-status";

export default function BugColumn({
  projectId,
  status,
  filters,
  disabled,
  onSelect,
}: {
  projectId: string;
  status: BugStatus;
  filters: BugFilters;
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const query = useBugs(projectId, status, page, filters);
  useEffect(() => {
    if (query.data && page > Math.max(1, query.data.pagination.totalPages))
      setPage(Math.max(1, query.data.pagination.totalPages));
  }, [query.data, page]);
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled });
  return (
    <section
      ref={setNodeRef}
      aria-label={t(bugStatusKeys[status])}
      className={cn(
        "min-h-48 min-w-0 rounded-xl border bg-muted/25 p-3",
        isOver && "border-primary bg-primary/5 ring-2 ring-primary/20",
      )}
    >
      <h2 className="mb-3 flex items-center justify-between px-1 text-sm font-semibold">
        {t(bugStatusKeys[status])}
        <span className="text-muted-foreground">
          {query.data?.pagination.total ?? "—"}
        </span>
      </h2>
      {query.isPending && (
        <p role="status" className="p-3 text-sm text-muted-foreground">
          {t("common:empty.loading")}
        </p>
      )}
      {query.isError && (
        <div role="alert" className="space-y-2 p-3 text-sm">
          <p>{t("tasks:bugs.loadError")}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void query.refetch()}
          >
            {t("tasks:bugs.retry")}
          </Button>
        </div>
      )}
      {query.data?.data.length === 0 && (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {t("tasks:bugs.empty")}
        </p>
      )}
      <div className="space-y-2">
        {query.data?.data.map((bug) => (
          <BugCard
            key={bug.id}
            bug={bug}
            disabled={disabled}
            onSelect={onSelect}
          />
        ))}
      </div>
      {query.data && (
        <BugPagination
          page={page}
          totalPages={query.data.pagination.totalPages}
          pending={query.isFetching}
          onChange={setPage}
        />
      )}
    </section>
  );
}
