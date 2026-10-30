import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { projectTable, workspaceUserTable } from "../database/schema";

export async function validateBugPeople(
  projectId: string,
  input: {
    reporterId?: string | null;
    fixerId?: string | null;
    verifierId?: string | null;
  },
) {
  const userIds = [
    ...new Set(
      [input.reporterId, input.fixerId, input.verifierId].filter(
        (id): id is string => typeof id === "string",
      ),
    ),
  ];
  if (!userIds.length) return;
  const members = await db
    .select({ userId: workspaceUserTable.userId })
    .from(workspaceUserTable)
    .innerJoin(
      projectTable,
      eq(projectTable.workspaceId, workspaceUserTable.workspaceId),
    )
    .where(
      and(
        eq(projectTable.id, projectId),
        inArray(workspaceUserTable.userId, userIds),
      ),
    );
  if (members.length !== userIds.length) {
    throw new HTTPException(400, {
      message:
        "Bug reporter, fixer and verifier must be current workspace members",
    });
  }
}
