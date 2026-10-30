import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

const api = client["mattermost-integration"].project[":projectId"];
export type UpdateMattermostIntegrationRequest = InferRequestType<
  typeof api.$patch
>["json"];

export default async function updateMattermostIntegration(
  projectId: string,
  json: UpdateMattermostIntegrationRequest,
) {
  const response = await api.$patch({ param: { projectId }, json });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
