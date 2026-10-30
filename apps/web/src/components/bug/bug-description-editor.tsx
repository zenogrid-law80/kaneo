import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import CommentEditor from "@/components/activity/comment-editor";
import { uploadBugAsset } from "@/lib/upload-bug-asset";

export default function BugDescriptionEditor({
  projectId,
  bugId,
  value,
  onChange,
  disabled,
  readOnly,
  onUploadingChange,
}: {
  projectId: string;
  bugId?: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  readOnly: boolean;
  onUploadingChange: (uploading: boolean) => void;
}) {
  const { t } = useTranslation();
  const uploads = useRef(0);
  const uploadAsset = useCallback(
    async (file: File) => {
      uploads.current += 1;
      onUploadingChange(true);
      try {
        return await uploadBugAsset(projectId, bugId, file);
      } finally {
        uploads.current -= 1;
        onUploadingChange(uploads.current > 0);
      }
    },
    [projectId, bugId, onUploadingChange],
  );
  return (
    <div className="w-full min-w-0 space-y-2">
      {!readOnly && (
        <p className="text-xs text-muted-foreground">
          {t("tasks:bugs.editorHint")}
        </p>
      )}
      <CommentEditor
        value={value}
        onChange={onChange}
        disabled={disabled}
        readOnly={readOnly}
        ariaLabel={t("tasks:bugs.description")}
        placeholder={t("tasks:detail.addDescription")}
        uploadAsset={uploadAsset}
        uploadSurface="description"
        className="w-full min-w-0 [&_.ProseMirror]:min-h-60 [&_.ProseMirror]:max-h-none [&_.ProseMirror]:overflow-visible [&_.ProseMirror]:px-0"
      />
    </div>
  );
}
