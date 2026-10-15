import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export default async function clearTaskSupportingAssignees({
  taskId,
}: {
  taskId: string;
}) {
  const response = await client.task["supporting-assignees"][":id"].$delete({
    param: { id: taskId },
  });
  if (!response.ok) throw new HttpError(response.status, await response.text());
}
