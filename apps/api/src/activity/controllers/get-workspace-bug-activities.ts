import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import db from "../../database";
import {
  bugCommentTable,
  bugHistoryTable,
  bugTable,
  projectTable,
  userTable,
} from "../../database/schema";
import { commentExcerpt } from "../comment-excerpt";

export default async function getWorkspaceBugActivities(
  workspaceId: string,
  projectIds: string[],
  since: Date,
  limit: number,
) {
  const projectScope = and(
    eq(projectTable.workspaceId, workspaceId),
    sql`${bugTable.projectId} = ANY(${sql.param(projectIds)}::text[])`,
    isNull(projectTable.archivedAt),
  );
  const resource = {
    bugId: bugTable.id,
    bugTitle: bugTable.title,
    projectId: projectTable.id,
    projectSlug: projectTable.slug,
    userName: userTable.name,
    userImage: userTable.image,
  };
  const [history, comments] = await Promise.all([
    db
      .select({
        ...resource,
        id: bugHistoryTable.id,
        type: bugHistoryTable.type,
        createdAt: bugHistoryTable.createdAt,
        userId: bugHistoryTable.userId,
      })
      .from(bugHistoryTable)
      .innerJoin(bugTable, eq(bugHistoryTable.bugId, bugTable.id))
      .innerJoin(projectTable, eq(bugTable.projectId, projectTable.id))
      .leftJoin(userTable, eq(bugHistoryTable.userId, userTable.id))
      .where(and(projectScope, gte(bugHistoryTable.createdAt, since)))
      .orderBy(desc(bugHistoryTable.createdAt), desc(bugHistoryTable.id))
      .limit(limit),
    // A comment occupies one feed item with its current text and latest edit time.
    db
      .select({
        ...resource,
        id: bugCommentTable.id,
        createdAt: bugCommentTable.createdAt,
        updatedAt: bugCommentTable.updatedAt,
        content: bugCommentTable.content,
        userId: bugCommentTable.userId,
      })
      .from(bugCommentTable)
      .innerJoin(bugTable, eq(bugCommentTable.bugId, bugTable.id))
      .innerJoin(projectTable, eq(bugTable.projectId, projectTable.id))
      .leftJoin(userTable, eq(bugCommentTable.userId, userTable.id))
      .where(and(projectScope, gte(bugCommentTable.updatedAt, since)))
      .orderBy(desc(bugCommentTable.updatedAt), desc(bugCommentTable.id))
      .limit(limit),
  ]);
  const shared = {
    resourceType: "bug" as const,
    eventData: null,
    externalUserName: null,
    externalUserAvatar: null,
  };
  return [
    ...history.map((row) => ({
      ...row,
      ...shared,
      id: `bug-history:${row.id}`,
      type: row.type === "created" ? "bug_created" : "bug_updated",
      excerpt: null,
    })),
    ...comments.map(({ content, updatedAt, ...row }) => ({
      ...row,
      ...shared,
      id: `bug-comment:${row.id}`,
      type:
        updatedAt.getTime() > row.createdAt.getTime()
          ? "bug_comment_updated"
          : "bug_comment_created",
      createdAt: updatedAt,
      excerpt: commentExcerpt(content),
    })),
  ];
}
