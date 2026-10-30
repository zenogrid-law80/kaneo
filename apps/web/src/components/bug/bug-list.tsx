import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BugFilters } from "@/fetchers/bug";
import { useBugs } from "@/hooks/queries/bug/use-bugs";
import { bugStatusKeys } from "./bug-status";
import BugPagination from "./bug-pagination";

export default function BugList({
  projectId,
  filters,
  onSelect,
}: {
  projectId: string;
  filters: BugFilters;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const query = useBugs(projectId, undefined, page, filters);
  useEffect(() => {
    if (query.data && page > Math.max(1, query.data.pagination.totalPages))
      setPage(Math.max(1, query.data.pagination.totalPages));
  }, [query.data, page]);
  return (
    <div className="space-y-3">
      {query.isPending && <p role="status">{t("common:empty.loading")}</p>}
      {query.isError && (
        <div role="alert" className="flex items-center gap-2 text-sm">
          <p>{t("tasks:bugs.loadError")}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
          >
            {t("tasks:bugs.retry")}
          </Button>
        </div>
      )}
      {query.data && (
        <>
          <p className="text-sm text-muted-foreground">
            {t("tasks:bugs.resultCount", {
              count: query.data.pagination.total,
            })}
          </p>
          <div className="rounded-lg border">
            <Table aria-label={t("tasks:bugs.listView")}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("tasks:bugs.issueTitle")}</TableHead>
                  <TableHead>{t("tasks:bugs.status")}</TableHead>
                  <TableHead>{t("tasks:bugs.reporter")}</TableHead>
                  <TableHead>{t("tasks:bugs.fixer")}</TableHead>
                  <TableHead>{t("tasks:bugs.verifier")}</TableHead>
                  <TableHead>{t("tasks:milestones.title")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.data.map((bug) => (
                  <TableRow key={bug.id}>
                    <TableCell className="min-w-56 max-w-md">
                      <button
                        type="button"
                        className="text-left font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                        onClick={() => onSelect(bug.id)}
                      >
                        {bug.title}
                      </button>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {t(bugStatusKeys[bug.status])}
                    </TableCell>
                    <TableCell>
                      {bug.reporter?.name ?? t("tasks:bugs.unrecorded")}
                    </TableCell>
                    <TableCell>
                      {bug.fixer?.name ?? t("tasks:bugs.unassigned")}
                    </TableCell>
                    <TableCell>
                      {bug.verifier?.name ?? t("tasks:bugs.unassigned")}
                    </TableCell>
                    <TableCell>
                      {bug.milestone?.name ?? t("tasks:milestones.none")}
                    </TableCell>
                  </TableRow>
                ))}
                {!query.data.data.length && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="p-8 text-center text-muted-foreground"
                    >
                      {t("tasks:bugs.noResults")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <BugPagination
            page={page}
            totalPages={query.data.pagination.totalPages}
            pending={query.isFetching}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}
