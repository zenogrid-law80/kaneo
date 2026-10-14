import { and, eq } from "drizzle-orm";
import db from "../../database";
import { milestoneTable } from "../../database/schema";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function getCurrentMilestone(
  projectId: string,
  tx: Transaction | typeof db = db,
) {
  const [milestone] = await tx
    .select()
    .from(milestoneTable)
    .where(
      and(
        eq(milestoneTable.projectId, projectId),
        eq(milestoneTable.isCurrent, true),
      ),
    )
    .limit(1);
  return milestone ?? null;
}

// Callers hold the project row lock so concurrent switches and task creation
// see exactly one current milestone, including when none was set previously.
export async function clearCurrentMilestone(
  tx: Transaction,
  projectId: string,
) {
  await tx
    .update(milestoneTable)
    .set({ isCurrent: false })
    .where(
      and(
        eq(milestoneTable.projectId, projectId),
        eq(milestoneTable.isCurrent, true),
      ),
    );
}
