import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export type MyTasksDueFilter = "all" | "overdue" | "today" | "undated";
export default async function getMyTasks(
  workspaceId: string,
  page: number,
  due: MyTasksDueFilter = "all",
  dayStart?: string,
  dayEnd?: string,
) {
  const response = await client.workspace[":workspaceId"]["my-tasks"].$get({
    param: { workspaceId },
    query: { page: String(page), due, dayStart, dayEnd },
  });
  if (!response.ok)
    throw new HttpError(response.status, "Failed to fetch my tasks");
  return response.json();
}
