import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const uploads = client.bug.project[":projectId"].uploads;
type UploadInput = {
  bugId?: string;
  filename: string;
  contentType: string;
  size: number;
};
export async function stageBugUpload(projectId: string, json: UploadInput) {
  const response = await uploads.$post({ param: { projectId }, json });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
export async function finalizeBugUpload(
  projectId: string,
  json: UploadInput & { key: string },
) {
  const response = await uploads.finalize.$post({ param: { projectId }, json });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
