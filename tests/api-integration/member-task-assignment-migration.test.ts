import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { beforeEach, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { defaultRolePayloads } from "../../packages/permissions/src";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

const migration = readFileSync(
  new URL(
    "../../apps/api/drizzle/0061_member-task-assignment.sql",
    import.meta.url,
  ),
  "utf8",
);

const oldMemberPayload = {
  organization: [],
  member: [],
  invitation: [],
  team: [],
  ac: ["read"],
  project: ["create", "read"],
  task: ["create", "read", "update"],
  label: ["create", "read", "update", "delete"],
  workspace: ["read"],
};

beforeEach(() => resetTestDatabase());

it("upgrades unchanged member defaults once and preserves customized roles", async () => {
  const { workspace } = await createWorkspaceMember();
  const customized = {
    ...oldMemberPayload,
    task: ["create", "read"],
  };
  const payloads = [
    { role: "member", permission: JSON.stringify(oldMemberPayload) },
    { role: "member", permission: JSON.stringify(customized) },
    { role: "reviewer", permission: JSON.stringify(oldMemberPayload) },
    { role: "member", permission: "invalid JSON" },
    { role: "member", permission: JSON.stringify(defaultRolePayloads.member) },
  ];
  await db.insert(schema.workspaceRoleTable).values(
    payloads.map((row, index) => ({
      ...row,
      id: `migration-role-${index}`,
      workspaceId: workspace.id,
    })),
  );

  const expected = payloads.map((row, index) => ({
    id: `migration-role-${index}`,
    permission:
      index === 0 ? JSON.stringify(defaultRolePayloads.member) : row.permission,
  }));
  for (let attempt = 0; attempt < 2; attempt++) {
    await db.execute(sql.raw(migration));
    const rows = await db
      .select({
        id: schema.workspaceRoleTable.id,
        permission: schema.workspaceRoleTable.permission,
      })
      .from(schema.workspaceRoleTable)
      .where(eq(schema.workspaceRoleTable.workspaceId, workspace.id))
      .orderBy(schema.workspaceRoleTable.id);
    expect(rows).toEqual(expected);
  }
});
