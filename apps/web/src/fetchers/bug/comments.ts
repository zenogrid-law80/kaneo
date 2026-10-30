import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const api = client.bug.project[":projectId"][":id"].comments;
export async function getBugComments(
  projectId: string,
  id: string,
  page: number,
) {
  const response = await api.$get({
    param: { projectId, id },
    query: { page: String(page) },
  });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
export type BugComment = Awaited<
  ReturnType<typeof getBugComments>
>["data"][number];
export async function createBugComment(
  projectId: string,
  id: string,
  content: string,
) {
  const response = await api.$post({
    param: { projectId, id },
    json: { content },
  });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
export async function updateBugComment(
  projectId: string,
  id: string,
  commentId: string,
  content: string,
) {
  const response = await api[":commentId"].$patch({
    param: { projectId, id, commentId },
    json: { content },
  });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
export async function deleteBugComment(
  projectId: string,
  id: string,
  commentId: string,
) {
  const response = await api[":commentId"].$delete({
    param: { projectId, id, commentId },
  });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}
