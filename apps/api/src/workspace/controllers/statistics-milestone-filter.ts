import { eq, isNull } from "drizzle-orm";
import { taskTable } from "../../database/schema";

export function statisticsMilestoneFilter(milestoneId?: string) {
  if (!milestoneId) return undefined;
  return milestoneId === "none"
    ? isNull(taskTable.milestoneId)
    : eq(taskTable.milestoneId, milestoneId);
}
