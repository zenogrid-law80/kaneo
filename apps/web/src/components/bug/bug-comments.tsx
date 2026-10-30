import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useBugComments } from "@/hooks/queries/bug/use-bug-comments";
import { useBugCommentMutations } from "@/hooks/mutations/bug/use-bug-comment-mutations";
import BugCommentCard from "./bug-comment-card";
import BugCommentComposer from "./bug-comment-composer";
import BugPagination from "./bug-pagination";

export default function BugComments({
  projectId,
  bugId,
  readOnly,
  disabled,
  onBusyChange,
}: {
  projectId: string;
  bugId: string;
  readOnly: boolean;
  disabled: boolean;
  onBusyChange: (change: number) => void;
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const query = useBugComments(projectId, bugId, page);
  const mutations = useBugCommentMutations(projectId, bugId);
  const totalPages = query.data?.pagination.totalPages;
  useEffect(() => {
    if (totalPages !== undefined && page > Math.max(1, totalPages))
      setPage(Math.max(1, totalPages));
  }, [page, totalPages]);
  return (
    <section
      className="space-y-3 border-t pt-4"
      aria-label={t("tasks:bugs.comments")}
    >
      <h3 className="text-sm font-semibold">
        {t("tasks:bugs.comments")}
        {query.data ? ` (${query.data.pagination.total})` : ""}
      </h3>
      {!readOnly && (
        <BugCommentComposer
          projectId={projectId}
          bugId={bugId}
          disabled={disabled}
          onBusyChange={onBusyChange}
          onSave={async (content) => {
            await mutations.create.mutateAsync(content);
            setPage(1);
          }}
        />
      )}
      {query.isPending ? (
        <p role="status">{t("common:empty.loading")}</p>
      ) : query.isError ? (
        <div role="alert" className="space-y-2">
          <p>{t("tasks:bugs.commentsError")}</p>
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
              {t("tasks:bugs.commentsEmpty")}
            </p>
          )}
          <ol className="space-y-3">
            {query.data.data.map((comment) => (
              <li key={comment.id}>
                <BugCommentCard
                  projectId={projectId}
                  comment={comment}
                  readOnly={readOnly}
                  disabled={disabled}
                  onBusyChange={onBusyChange}
                />
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
