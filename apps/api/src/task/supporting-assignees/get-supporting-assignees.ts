import { and, asc, eq, sql } from "drizzle-orm";
import db from "../../database";
import {
  projectTable,
  taskSupportingAssigneeTable,
  taskTable,
  userTable,
  workspaceUserTable,
} from "../../database/schema";

export default async function getSupportingAssignees(
  taskId: string,
  workspaceId: string,
) {
  return db
    .select({
      userId: userTable.id,
      name: userTable.name,
      image: userTable.image,
    })
    .from(taskSupportingAssigneeTable)
    .innerJoin(taskTable, eq(taskTable.id, taskSupportingAssigneeTable.taskId))
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .innerJoin(
      workspaceUserTable,
      eq(workspaceUserTable.id, taskSupportingAssigneeTable.membershipId),
    )
    .innerJoin(userTable, eq(userTable.id, workspaceUserTable.userId))
    .where(
      and(
        eq(taskTable.id, taskId),
        sql`${taskTable.userId} is distinct from ${userTable.id}`,
        eq(projectTable.workspaceId, workspaceId),
        eq(workspaceUserTable.workspaceId, workspaceId),
      ),
    )
    .groupBy(userTable.id, userTable.name, userTable.image)
    .orderBy(
      asc(sql`min(${taskSupportingAssigneeTable.createdAt})`),
      asc(userTable.id),
    );
}
