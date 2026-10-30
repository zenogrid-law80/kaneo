import { stageBugUpload, finalizeBugUpload } from "@/fetchers/bug/upload";
import {
  getImageAltText,
  getTaskAssetContentType,
  isSupportedImageFile,
} from "./upload-task-image";
import { i18n } from "./i18n";

export async function uploadBugAsset(
  projectId: string,
  bugId: string | undefined,
  file: File,
) {
  const input = {
    bugId,
    filename: file.name || "file",
    contentType: getTaskAssetContentType(file),
    size: file.size,
  };
  const upload = await stageBugUpload(projectId, input);
  const response = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers: upload.headers,
    body: file,
  });
  if (!response.ok)
    throw new Error(i18n.t("activity:comment.editor.failedToUploadFile"));
  const asset = await finalizeBugUpload(projectId, {
    ...input,
    key: upload.key,
  });
  return {
    url: asset.url,
    alt: getImageAltText(input.filename),
    filename: input.filename,
    mimeType: input.contentType,
    size: file.size,
    kind: isSupportedImageFile(file)
      ? ("image" as const)
      : ("attachment" as const),
  };
}
