import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

const api = client["mattermost-integration"].project[":projectId"];
export type CreateMattermostIntegrationRequest = InferRequestType<
  typeof api.$post
>["json"];

export default async function createMattermostIntegration(
  projectId: string,
  json: CreateMattermostIntegrationRequest,
) {
  const response = await api.$post({ param: { projectId }, json });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
