import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

const api = client.milestone;
export type Milestone = InferResponseType<(typeof api)[":id"]["$get"], 200>;
export type MilestoneListQuery = InferRequestType<
  (typeof api.project)[":projectId"]["$get"]
>["query"];
export type MilestoneInput = InferRequestType<
  (typeof api.project)[":projectId"]["$post"]
>["json"];
export type MilestoneUpdate = InferRequestType<
  (typeof api)[":id"]["$patch"]
>["json"];

export async function getMilestones(
  projectId: string,
  query: MilestoneListQuery = {},
) {
  const response = await api.project[":projectId"].$get({
    param: { projectId },
    query,
  });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
export async function getMilestone(id: string) {
  const response = await api[":id"].$get({ param: { id } });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
export async function getCurrentMilestone(projectId: string) {
  const response = await api.project[":projectId"].current.$get({
    param: { projectId },
  });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
export async function getMilestoneTasks(
  id: string,
  page = 1,
  archived = false,
) {
  const response = await api[":id"].tasks.$get({
    param: { id },
    query: {
      page: String(page),
      limit: "50",
      archived: archived ? "true" : "false",
    },
  });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
export async function createMilestone(projectId: string, json: MilestoneInput) {
  const response = await api.project[":projectId"].$post({
    param: { projectId },
    json,
  });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
export async function updateMilestone(id: string, json: MilestoneUpdate) {
  const response = await api[":id"].$patch({ param: { id }, json });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
export async function deleteMilestone(id: string) {
  const response = await api[":id"].$delete({ param: { id } });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
export async function updateTaskMilestone(
  id: string,
  milestoneId: string | null,
) {
  const response = await client.task[":id"].milestone.$patch({
    param: { id },
    json: { milestoneId },
  });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}

export async function getMilestoneCandidates(
  projectId: string,
  search: string,
  page: number,
) {
  const response = await client.task.tasks[":projectId"].$get({
    param: { projectId },
    query: {
      withoutMilestone: "true",
      search,
      page: String(page),
      limit: "50",
      sortBy: "title",
    },
  });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  const result = await response.json();
  return {
    data: [
      ...result.data.columns.flatMap((column) => column.tasks),
      ...result.data.plannedTasks,
      ...result.data.archivedTasks,
    ],
    pagination: result.pagination,
  };
}
