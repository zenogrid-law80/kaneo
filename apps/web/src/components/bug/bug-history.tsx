import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useBugHistory } from "@/hooks/queries/bug/use-bugs";
import { Button } from "@/components/ui/button";
import BugHistoryChange from "./bug-history-change";
import BugPagination from "./bug-pagination";

export default function BugHistory({
  projectId,
  bugId,
}: {
  projectId: string;
  bugId: string;
}) {
  const { t, i18n } = useTranslation();
  const [page, setPage] = useState(1);
  const query = useBugHistory(projectId, bugId, page);
  return (
    <section
      className="space-y-3 border-t pt-4"
      aria-label={t("tasks:bugs.history")}
    >
      <h3 className="text-sm font-semibold">{t("tasks:bugs.history")}</h3>
      {query.isPending ? (
        <p role="status">{t("common:empty.loading")}</p>
      ) : query.isError ? (
        <div role="alert">
          <p>{t("tasks:bugs.historyError")}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void query.refetch()}
          >
            {t("tasks:bugs.retry")}
          </Button>
        </div>
      ) : (
        <>
          {query.data.data.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("tasks:bugs.historyEmpty")}
            </p>
          )}
          <ol className="space-y-4">
            {query.data.data.map((entry) => (
              <li key={entry.id} className="space-y-1 border-l-2 pl-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                  <span className="font-medium">
                    {entry.user?.name ?? t("tasks:bugs.historyUnknownUser")}
                  </span>
                  <time
                    className="text-muted-foreground"
                    dateTime={entry.createdAt}
                  >
                    {new Date(entry.createdAt).toLocaleString(i18n.language)}
                  </time>
                </div>
                {entry.type === "created" ? (
                  <p className="text-sm">{t("tasks:bugs.historyCreated")}</p>
                ) : (
                  entry.changes.map((change) => (
                    <BugHistoryChange key={change.field} change={change} />
                  ))
                )}
              </li>
            ))}
          </ol>
          <BugPagination
            page={page}
            totalPages={query.data.pagination.totalPages}
            pending={query.isFetching}
            onChange={setPage}
          />
        </>
      )}
    </section>
  );
}
