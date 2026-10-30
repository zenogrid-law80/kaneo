import { and, count, desc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { bugCommentTable, bugTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { lockMilestoneProjects } from "../../milestone/controllers/milestones";
import { claimBugAssets } from "../controllers/claim-assets";
import { removeBugCommentAssets } from "./assets";

const user = { columns: { id: true, name: true, image: true } } as const;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function lockBug(tx: Transaction, projectId: string, bugId: string) {
  // Share the deletion lock order so uploads cannot be claimed after cleanup is queued.
  await lockMilestoneProjects(tx, [projectId]);
  const [bug] = await tx
    .select({ id: bugTable.id })
    .from(bugTable)
    .where(and(eq(bugTable.id, bugId), eq(bugTable.projectId, projectId)))
    .for("update");
  if (!bug) throw new HTTPException(404, { message: "Bug not found" });
}

export async function listBugComments(
  projectId: string,
  bugId: string,
  page: number,
) {
  const bug = await db.query.bugTable.findFirst({
    columns: { id: true },
    where: and(eq(bugTable.id, bugId), eq(bugTable.projectId, projectId)),
  });
  if (!bug) throw new HTTPException(404, { message: "Bug not found" });
  const where = eq(bugCommentTable.bugId, bugId);
  const [data, [total]] = await Promise.all([
    db.query.bugCommentTable.findMany({
      where,
      with: { user },
      orderBy: [desc(bugCommentTable.createdAt), desc(bugCommentTable.id)],
      limit: 20,
      offset: (page - 1) * 20,
    }),
    db.select({ count: count() }).from(bugCommentTable).where(where),
  ]);
  return {
    data,
    pagination: {
      page,
      total: total?.count ?? 0,
      totalPages: Math.ceil((total?.count ?? 0) / 20),
    },
  };
}

export async function createBugComment(
  projectId: string,
  bugId: string,
  userId: string,
  content: string,
) {
  const comment = await db.transaction(async (tx) => {
    await lockBug(tx, projectId, bugId);
    const [created] = await tx
      .insert(bugCommentTable)
      .values({ bugId, userId, content })
      .returning();
    if (!created)
      throw new HTTPException(500, { message: "Failed to create comment" });
    await claimBugAssets(tx, projectId, bugId, userId, content, created.id);
    return tx.query.bugCommentTable.findFirst({
      where: eq(bugCommentTable.id, created.id),
      with: { user },
    });
  });
  if (!comment)
    throw new HTTPException(500, { message: "Failed to create comment" });
  await publishEvent("bug.comments.changed", { projectId, bugId });
  return comment;
}

export async function updateBugComment(
  projectId: string,
  bugId: string,
  commentId: string,
  userId: string,
  content: string,
) {
  const result = await db.transaction(async (tx) => {
    await lockBug(tx, projectId, bugId);
    const where = and(
      eq(bugCommentTable.id, commentId),
      eq(bugCommentTable.bugId, bugId),
      eq(bugCommentTable.userId, userId),
    );
    const current = await tx.query.bugCommentTable.findFirst({ where });
    if (!current)
      throw new HTTPException(404, {
        message: "Comment not found or not owned by you",
      });
    if (current.content === content)
      return {
        comment: await tx.query.bugCommentTable.findFirst({
          where,
          with: { user },
        }),
        changed: false,
      };
    await claimBugAssets(tx, projectId, bugId, userId, content, commentId);
    await removeBugCommentAssets(tx, commentId, content);
    await tx
      .update(bugCommentTable)
      .set({ content, updatedAt: new Date() })
      .where(where);
    return {
      comment: await tx.query.bugCommentTable.findFirst({
        where,
        with: { user },
      }),
      changed: true,
    };
  });
  const { comment, changed } = result;
  if (!comment) throw new HTTPException(404, { message: "Comment not found" });
  if (changed) await publishEvent("bug.comments.changed", { projectId, bugId });
  return comment;
}

export async function deleteBugComment(
  projectId: string,
  bugId: string,
  commentId: string,
  userId: string,
) {
  await db.transaction(async (tx) => {
    await lockBug(tx, projectId, bugId);
    const where = and(
      eq(bugCommentTable.id, commentId),
      eq(bugCommentTable.bugId, bugId),
      eq(bugCommentTable.userId, userId),
    );
    const current = await tx.query.bugCommentTable.findFirst({ where });
    if (!current)
      throw new HTTPException(404, {
        message: "Comment not found or not owned by you",
      });
    await removeBugCommentAssets(tx, commentId);
    await tx.delete(bugCommentTable).where(where);
  });
  await publishEvent("bug.comments.changed", { projectId, bugId });
  return { success: true };
}
