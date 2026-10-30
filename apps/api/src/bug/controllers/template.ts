import { eq } from "drizzle-orm";
import db from "../../database";
import { bugTemplateTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { DEFAULT_BUG_TEMPLATE } from "../default-template";

export async function getBugTemplate(projectId: string) {
  const [row] = await db
    .select()
    .from(bugTemplateTable)
    .where(eq(bugTemplateTable.projectId, projectId));
  return { template: row?.template ?? DEFAULT_BUG_TEMPLATE, isDefault: !row };
}
export async function updateBugTemplate(
  projectId: string,
  template: string | null,
) {
  if (template === null) {
    await db
      .delete(bugTemplateTable)
      .where(eq(bugTemplateTable.projectId, projectId));
  } else {
    await db
      .insert(bugTemplateTable)
      .values({ projectId, template })
      .onConflictDoUpdate({
        target: bugTemplateTable.projectId,
        set: { template },
      });
  }
  await publishEvent("bug.template.updated", { projectId });
  return {
    template: template ?? DEFAULT_BUG_TEMPLATE,
    isDefault: template === null,
  };
}
