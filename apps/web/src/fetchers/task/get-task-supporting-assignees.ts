import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export default async function getTaskSupportingAssignees(taskId: string) {
  const response = await client.task["supporting-assignees"][":id"].$get({
    param: { id: taskId },
  });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
