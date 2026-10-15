import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { beforeEach, expect, it } from "vite-plus/test";
import db from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";

const migration = readFileSync(
  new URL("../../apps/api/drizzle/0064_tiresome_spirit.sql", import.meta.url),
  "utf8",
);
beforeEach(resetTestDatabase);

it("upgrades existing assignments and recovers the latest add time without dropping members lacking history", async () => {
  await db.transaction(async (tx) => {
    // Temporary tables shadow public tables only on this transaction's connection.
    await tx.execute(
      sql.raw(`
      CREATE TEMP TABLE task_supporting_assignee (task_id text, membership_id text) ON COMMIT DROP;
      CREATE TEMP TABLE workspace_member (id text, user_id text) ON COMMIT DROP;
      CREATE TEMP TABLE activity (task_id text, type text, event_data jsonb, created_at timestamp) ON COMMIT DROP;
      INSERT INTO workspace_member VALUES ('membership-a', 'a'), ('membership-b', 'b');
      INSERT INTO task_supporting_assignee VALUES ('task', 'membership-a'), ('task', 'membership-b');
      INSERT INTO activity VALUES
        ('task', 'supporting_assignee_added', '{"supportingAssigneeId":"a"}', '2026-01-01'),
        ('task', 'supporting_assignee_removed', '{"supportingAssigneeId":"a"}', '2026-01-02'),
        ('task', 'supporting_assignee_added', '{"supportingAssigneeId":"a"}', '2026-01-03'),
        ('another-task', 'supporting_assignee_added', '{"supportingAssigneeId":"a"}', '2026-02-01');
    `),
    );
    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim()) await tx.execute(sql.raw(statement));
    }
    const result = await tx.execute<{
      membership_id: string;
      created_at: string;
    }>(
      sql`SELECT membership_id, created_at FROM task_supporting_assignee ORDER BY membership_id`,
    );
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].created_at).toBe("2026-01-03 00:00:00");
    expect(result.rows[1].created_at).toEqual(expect.any(String));
    expect(Number.isFinite(Date.parse(result.rows[1].created_at))).toBe(true);
    await tx.execute(
      sql`INSERT INTO task_supporting_assignee (task_id, membership_id) VALUES ('task', 'membership-c')`,
    );
    const next = await tx.execute<{ created_at: string }>(
      sql`SELECT created_at FROM task_supporting_assignee WHERE membership_id = 'membership-c'`,
    );
    expect(Number.isFinite(Date.parse(next.rows[0].created_at))).toBe(true);
  });
});
