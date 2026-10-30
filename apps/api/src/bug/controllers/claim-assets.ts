import { and, eq, inArray, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type db from "../../database";
import { assetTable, projectTable } from "../../database/schema";
import { extractAssetIds } from "../../storage/cleanup-assets";

export async function claimBugAssets(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  projectId: string,
  bugId: string,
  userId: string,
  description: string,
  commentId?: string,
) {
  const ids = [...extractAssetIds(description)];
  if (!ids.length) return;
  const project = await tx.query.projectTable.findFirst({
    where: eq(projectTable.id, projectId),
    columns: { workspaceId: true },
  });
  if (!project) throw new HTTPException(404, { message: "Project not found" });
  await tx
    .update(assetTable)
    .set({
      bugId,
      bugCommentId: commentId ?? null,
      surface: commentId ? "bug-comment" : "bug-description",
      workspaceId: project.workspaceId,
    })
    .where(
      and(
        inArray(assetTable.id, ids),
        eq(assetTable.projectId, projectId),
        eq(assetTable.createdBy, userId),
        eq(assetTable.surface, "draft"),
        isNull(assetTable.taskId),
        isNull(assetTable.bugId),
        isNull(assetTable.bugCommentId),
      ),
    );
  const owned = await tx
    .select({ id: assetTable.id })
    .from(assetTable)
    .where(
      and(
        inArray(assetTable.id, ids),
        eq(assetTable.bugId, bugId),
        eq(assetTable.projectId, projectId),
        commentId
          ? eq(assetTable.bugCommentId, commentId)
          : isNull(assetTable.bugCommentId),
      ),
    );
  if (owned.length !== ids.length)
    throw new HTTPException(400, {
      message:
        "Attachments must belong to this content or be your finalized uploads in this project",
    });
  // Keep prior description attachments for the history; deleting the bug queues them for cleanup.
}
