import { useState } from "react";
import { useTranslation } from "react-i18next";
import CommentEditor from "@/components/activity/comment-editor";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { BugComment } from "@/fetchers/bug/comments";
import { useBugCommentMutations } from "@/hooks/mutations/bug/use-bug-comment-mutations";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { getInitials } from "@/lib/get-initials";
import BugCommentComposer from "./bug-comment-composer";
import DeleteBugComment from "./delete-bug-comment";

export default function BugCommentCard({
  projectId,
  comment,
  readOnly,
  disabled,
  onBusyChange,
}: {
  projectId: string;
  comment: BugComment;
  readOnly: boolean;
  disabled: boolean;
  onBusyChange: (change: number) => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const mutations = useBugCommentMutations(projectId, comment.bugId);
  const canEdit = !readOnly && !!user && user.id === comment.userId;
  return (
    <article className="rounded-xl border border-border/80 bg-card/60">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
        <Avatar className="size-6">
          <AvatarImage src={comment.user?.image ?? ""} alt="" />
          <AvatarFallback>{getInitials(comment.user?.name)}</AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium">
          {comment.user?.name ?? t("tasks:bugs.historyUnknownUser")}
        </span>
        <time
          dateTime={comment.createdAt}
          title={formatDateTime(comment.createdAt)}
          className="text-muted-foreground"
        >
          {formatRelativeTime(comment.createdAt)}
        </time>
        {comment.updatedAt !== comment.createdAt && (
          <span
            title={formatDateTime(comment.updatedAt)}
            className="text-muted-foreground"
          >
            ({t("tasks:bugs.commentEdited")})
          </span>
        )}
        {canEdit && !editing && (
          <div className="ml-auto flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={disabled || mutations.remove.isPending}
              onClick={() => setEditing(true)}
            >
              {t("activity:comment.edit")}
            </Button>
            <DeleteBugComment
              disabled={disabled}
              onDelete={async () => {
                onBusyChange(1);
                try {
                  await mutations.remove.mutateAsync(comment.id);
                } finally {
                  onBusyChange(-1);
                }
              }}
            />
          </div>
        )}
      </div>
      {editing && canEdit ? (
        <div className="px-3 pb-3">
          <BugCommentComposer
            projectId={projectId}
            bugId={comment.bugId}
            initialContent={comment.content}
            disabled={disabled}
            onBusyChange={onBusyChange}
            onCancel={() => setEditing(false)}
            onSave={async (content) => {
              await mutations.update.mutateAsync({ id: comment.id, content });
              setEditing(false);
            }}
          />
        </div>
      ) : (
        <CommentEditor value={comment.content} readOnly />
      )}
    </article>
  );
}
