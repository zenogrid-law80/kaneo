import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import db from "../../database";
import {
  activityTable,
  columnTable,
  projectTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { commentExcerpt } from "../comment-excerpt";

async function getWorkspaceTaskActivities(
  workspaceId: string,
  projectIds: string[],
  since: Date,
  limit: number,
) {
  const rows = await db
    .select({
      id: activityTable.id,
      type: activityTable.type,
      createdAt: activityTable.createdAt,
      content: activityTable.content,
      eventData: activityTable.eventData,
      userId: activityTable.userId,
      userName: userTable.name,
      userImage: userTable.image,
      externalUserName: activityTable.externalUserName,
      externalUserAvatar: activityTable.externalUserAvatar,
      taskId: taskTable.id,
      taskTitle: taskTable.title,
      taskNumber: taskTable.number,
      projectId: projectTable.id,
      projectSlug: projectTable.slug,
    })
    .from(activityTable)
    .innerJoin(taskTable, eq(activityTable.taskId, taskTable.id))
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .leftJoin(userTable, eq(activityTable.userId, userTable.id))
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        sql`${taskTable.projectId} = ANY(${sql.param(projectIds)}::text[])`,
        isNull(projectTable.archivedAt),
        gte(activityTable.createdAt, since),
      ),
    )
    .orderBy(desc(activityTable.createdAt), desc(activityTable.id))
    .limit(limit);

  const statusChanges = rows.filter((row) => row.type === "status_changed");
  const statusSlugs = [
    ...new Set(
      statusChanges.flatMap((row) => {
        const data = statusData(row.eventData);
        return [data?.oldStatus, data?.newStatus].filter(
          (value): value is string => typeof value === "string",
        );
      }),
    ),
  ];
  const columns = statusSlugs.length
    ? await db
        .select({
          projectId: columnTable.projectId,
          slug: columnTable.slug,
          name: columnTable.name,
        })
        .from(columnTable)
        .innerJoin(projectTable, eq(columnTable.projectId, projectTable.id))
        .where(
          and(
            eq(projectTable.workspaceId, workspaceId),
            inArray(columnTable.projectId, [
              ...new Set(statusChanges.map((row) => row.projectId)),
            ]),
            inArray(columnTable.slug, statusSlugs),
          ),
        )
    : [];

  return rows.map(({ content, ...row }) => {
    const data =
      row.type === "status_changed" ? statusData(row.eventData) : null;
    const nameOf = (slug: unknown) => {
      const matching = columns.filter(
        (column) => column.projectId === row.projectId && column.slug === slug,
      );
      // Historical events only store slugs. Duplicates cannot identify a column.
      return matching.length === 1 ? matching[0]?.name : undefined;
    };
    return {
      ...row,
      resourceType: "task" as const,
      eventData: data
        ? {
            ...data,
            oldStatusName: nameOf(data.oldStatus),
            newStatusName: nameOf(data.newStatus),
          }
        : row.eventData,
      excerpt: commentExcerpt(content),
    };
  });
}

function statusData(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export default getWorkspaceTaskActivities;
