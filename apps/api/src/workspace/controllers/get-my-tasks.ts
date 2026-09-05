import { and, asc, eq, gte, isNull, lt, ne, sql } from "drizzle-orm";
import db from "../../database";
import { columnTable, projectTable, taskTable } from "../../database/schema";

const PAGE_SIZE = 12;

export default async function getMyTasks(
  workspaceId: string,
  userId: string,
  page: number,
  due: "all" | "overdue" | "today" | "undated" = "all",
  dayStart?: string,
  dayEnd?: string,
) {
  const dateFilter =
    due === "undated"
      ? isNull(taskTable.dueDate)
      : due === "overdue" && dayStart
        ? lt(taskTable.dueDate, new Date(dayStart))
        : due === "today" && dayStart && dayEnd
          ? and(
              gte(taskTable.dueDate, new Date(dayStart)),
              lt(taskTable.dueDate, new Date(dayEnd)),
            )
          : undefined;
  const rows = await db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      number: taskTable.number,
      priority: taskTable.priority,
      dueDate: taskTable.dueDate,
      projectId: projectTable.id,
      projectName: projectTable.name,
      projectSlug: projectTable.slug,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .leftJoin(
      columnTable,
      and(
        eq(columnTable.projectId, projectTable.id),
        eq(columnTable.slug, taskTable.status),
      ),
    )
    .where(
      and(
        dateFilter,
        eq(projectTable.workspaceId, workspaceId),
        isNull(projectTable.archivedAt),
        eq(taskTable.userId, userId),
        ne(taskTable.status, "archived"),
        // Respect custom final columns, including a renamed default Done column.
        sql`coalesce(${columnTable.isFinal}, ${taskTable.status} = 'done') = false`,
      ),
    )
    .orderBy(sql`${taskTable.dueDate} asc nulls last`, asc(taskTable.id))
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE);
  return { items: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE };
}
