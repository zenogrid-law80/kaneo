import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

const api = client.bug.project[":projectId"];
export type Bug = InferResponseType<(typeof api)[":id"]["$get"], 200>;
export type BugSummary = Omit<Bug, "description">;
export type BugStatus = Bug["status"];
export type BugInput = InferRequestType<typeof api.$post>["json"];
export type BugUpdate = InferRequestType<(typeof api)[":id"]["$patch"]>["json"];
export type BugFilters = Pick<
  InferRequestType<typeof api.$get>["query"],
  "reporterId" | "fixerId" | "verifierId" | "milestoneId"
>;
export async function getBugs(
  projectId: string,
  status: BugStatus | undefined,
  page: number,
  filters: BugFilters = {},
) {
  const response = await api.$get({
    param: { projectId },
    query: { ...filters, status, page: String(page), limit: "50" },
  });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
export async function getBug(projectId: string, id: string) {
  const response = await api[":id"].$get({ param: { projectId, id } });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
export async function createBug(projectId: string, json: BugInput) {
  const response = await api.$post({ param: { projectId }, json });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
export async function updateBug(
  projectId: string,
  id: string,
  json: BugUpdate,
) {
  const response = await api[":id"].$patch({ param: { projectId, id }, json });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
export async function deleteBug(projectId: string, id: string) {
  const response = await api[":id"].$delete({ param: { projectId, id } });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
export async function getBugTemplate(projectId: string) {
  const response = await api.template.$get({ param: { projectId } });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
export async function updateBugTemplate(
  projectId: string,
  template: string | null,
) {
  const response = await api.template.$put({
    param: { projectId },
    json: { template },
  });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}

export async function getBugHistory(
  projectId: string,
  id: string,
  page: number,
) {
  const response = await api[":id"].history.$get({
    param: { projectId, id },
    query: { page: String(page) },
  });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
export type BugHistoryEntry = Awaited<
  ReturnType<typeof getBugHistory>
>["data"][number];
