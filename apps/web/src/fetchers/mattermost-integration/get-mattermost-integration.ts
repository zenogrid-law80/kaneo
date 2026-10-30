import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

const api = client["mattermost-integration"].project[":projectId"];
export type MattermostIntegration = InferResponseType<typeof api.$get, 200>;

export default async function getMattermostIntegration(projectId: string) {
  const response = await api.$get({ param: { projectId } });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
