import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export default async function setTaskSupportingAssignee({
  taskId,
  userId,
  assigned,
}: {
  taskId: string;
  userId: string;
  assigned: boolean;
}) {
  const endpoint = client.task["supporting-assignees"][":id"][":userId"];
  const input = { param: { id: taskId, userId } };
  const response = await (assigned
    ? endpoint.$put(input)
    : endpoint.$delete(input));
  if (!response.ok) throw new HttpError(response.status, await response.text());
}
