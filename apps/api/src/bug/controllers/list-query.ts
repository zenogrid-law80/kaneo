import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
  type SQLWrapper,
} from "drizzle-orm";
import { bugTable } from "../../database/schema";
import type { z } from "../../openapi";
import type { listBugsQuery } from "../schema";
import { bugPriorities, bugSeverities, bugEnvironments } from "../metadata";

export function bugListQuery(
  projectId: string,
  query: z.infer<typeof listBugsQuery>,
) {
  const term = query.search?.trim();
  const pattern = term ? `%${term.replace(/[\\%_]/g, "\\$&")}%` : undefined;
  const where = and(
    eq(bugTable.projectId, projectId),
    query.status ? eq(bugTable.status, query.status) : undefined,
    pattern
      ? or(ilike(bugTable.title, pattern), ilike(bugTable.description, pattern))
      : undefined,
    ...(["reporterId", "fixerId", "verifierId", "environment"] as const).map(
      (key) => {
        const selected = query[key]?.split(",") ?? [];
        if (!selected.length) return undefined;
        const ids = selected.filter((id) => id !== "none");
        return or(
          selected.includes("none") ? isNull(bugTable[key]) : undefined,
          ids.length ? inArray(bugTable[key], ids) : undefined,
        );
      },
    ),
    query.priority
      ? inArray(
          bugTable.priority,
          query.priority.split(",") as (typeof bugPriorities)[number][],
        )
      : undefined,
    query.severity
      ? inArray(
          bugTable.severity,
          query.severity.split(",") as (typeof bugSeverities)[number][],
        )
      : undefined,
    query.milestoneId === "none"
      ? isNull(bugTable.milestoneId)
      : query.milestoneId
        ? eq(bugTable.milestoneId, query.milestoneId)
        : undefined,
  );
  const ranks = {
    priority: bugPriorities.slice(1),
    severity: bugSeverities.slice(1),
    environment: bugEnvironments,
  };
  let sortValue: SQLWrapper = bugTable[query.sortBy];
  if (
    query.sortBy === "priority" ||
    query.sortBy === "severity" ||
    query.sortBy === "environment"
  ) {
    sortValue = sql`CASE ${bugTable[query.sortBy]} ${sql.join(
      ranks[query.sortBy].map(
        (value, index) => sql`WHEN ${value} THEN ${index + 1}`,
      ),
      sql` `,
    )} ELSE NULL END`;
  }
  const direction = query.sortOrder === "asc" ? asc : desc;
  return {
    where,
    orderBy: [
      sql`${direction(sortValue)} NULLS LAST`,
      desc(bugTable.createdAt),
      desc(bugTable.id),
    ],
  };
}
