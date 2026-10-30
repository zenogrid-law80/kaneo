import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import CommentEditor from "@/components/activity/comment-editor";
import { Button } from "@/components/ui/button";
import { uploadBugAsset } from "@/lib/upload-bug-asset";

export default function BugCommentComposer({
  projectId,
  bugId,
  initialContent = "",
  disabled,
  onSave,
  onCancel,
  onBusyChange,
}: {
  projectId: string;
  bugId: string;
  initialContent?: string;
  disabled: boolean;
  onSave: (content: string) => Promise<unknown>;
  onCancel?: () => void;
  onBusyChange: (change: number) => void;
}) {
  const { t } = useTranslation();
  const [content, setContent] = useState(initialContent);
  const [pending, setPending] = useState(false);
  const [uploads, setUploads] = useState(0);
  const uploading = useRef(0);
  const submitting = useRef(false);
  const [failed, setFailed] = useState(false);
  const busy = pending || uploads > 0;
  useEffect(() => {
    if (!busy) return;
    onBusyChange(1);
    return () => onBusyChange(-1);
  }, [busy, onBusyChange]);
  const uploadAsset = useCallback(
    async (file: File) => {
      uploading.current += 1;
      setUploads(uploading.current);
      try {
        return await uploadBugAsset(projectId, bugId, file);
      } finally {
        uploading.current -= 1;
        setUploads(uploading.current);
      }
    },
    [projectId, bugId],
  );
  const submit = async () => {
    if (
      disabled ||
      submitting.current ||
      uploading.current ||
      !content.trim() ||
      content.length > 10000
    )
      return;
    submitting.current = true;
    setPending(true);
    setFailed(false);
    try {
      await onSave(content.trim());
      setContent("");
    } catch {
      setFailed(true);
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };
  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-border/80 bg-card/60">
        <CommentEditor
          value={content}
          onChange={setContent}
          ariaLabel={
            onCancel
              ? t("activity:comment.edit")
              : t("tasks:bugs.commentPlaceholder")
          }
          placeholder={t("tasks:bugs.commentPlaceholder")}
          disabled={disabled || pending}
          uploadAsset={uploadAsset}
          onSubmitShortcut={() => void submit()}
          onCancelShortcut={busy ? undefined : onCancel}
          className="[&_.ProseMirror]:min-h-24 [&_.ProseMirror]:max-h-none"
        />
        <div className="flex justify-end gap-2 border-t px-3 py-2">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || busy}
              onClick={onCancel}
            >
              {t("common:actions.cancel")}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            disabled={
              disabled || busy || !content.trim() || content.length > 10000
            }
            onClick={() => void submit()}
          >
            {pending
              ? t("tasks:bugs.saving")
              : onCancel
                ? t("activity:comment.save")
                : t("tasks:bugs.addComment")}
          </Button>
        </div>
      </div>
      {content.length > 10000 && (
        <p role="alert" className="text-sm text-destructive">
          {t("tasks:bugs.commentLimit")}
        </p>
      )}
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {onCancel
            ? t("activity:comment.failedToUpdate")
            : t("activity:comment.failedToAdd")}
        </p>
      )}
    </div>
  );
}
