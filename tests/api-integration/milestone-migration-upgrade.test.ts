import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { describe, expect, it } from "vite-plus/test";
import { reconcileMilestoneMigration } from "../../apps/api/src/database/reconcile-milestone-migration";

const migrationsFolder = fileURLToPath(
  new URL("../../apps/api/drizzle", import.meta.url),
);
const legacySql = readFileSync(
  new URL("./fixtures/milestone-legacy-main.sql", import.meta.url),
  "utf8",
);
const migrations = readMigrationFiles({ migrationsFolder });

async function withUpgradeDatabase(run: (client: Client) => Promise<void>) {
  const url = new URL(process.env.DATABASE_URL!);
  if (!url.pathname.endsWith("_test"))
    throw new Error("Upgrade tests require a test database");
  const name = `milestone_${randomUUID().replaceAll("-", "")}_test`;
  url.pathname = "/postgres";
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  url.pathname = `/${name}`;
  const client = new Client({ connectionString: url.toString() });
  try {
    await client.connect();
    await run(client);
  } finally {
    await client.end();
    await admin.query(`DROP DATABASE "${name}"`);
    await admin.end();
  }
}

async function applyHistory(client: Client, count: number) {
  await client.query(
    "CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint)",
  );
  for (const migration of migrations.slice(0, count)) {
    for (const statement of migration.sql) await client.query(statement);
    await client.query(
      "INSERT INTO drizzle.__drizzle_migrations(hash, created_at) VALUES ($1, $2)",
      [migration.hash, migration.folderMillis],
    );
  }
}

describe("milestone migration branch integration", () => {
  it("upgrades main's legacy 0045 without losing milestone data or skipping upstream migrations", async () => {
    await withUpgradeDatabase(async (client) => {
      await applyHistory(client, 45);
      for (const statement of legacySql.split("--> statement-breakpoint"))
        await client.query(statement);
      await client.query(
        "INSERT INTO drizzle.__drizzle_migrations(hash, created_at) VALUES ($1, $2)",
        [createHash("sha256").update(legacySql).digest("hex"), 1791878252275],
      );
      await client.query(`
        INSERT INTO workspace(id, name, slug, created_at) VALUES ('workspace', 'Workspace', 'workspace', now());
        INSERT INTO project(id, workspace_id, name, slug) VALUES ('project', 'workspace', 'Project', 'project');
        INSERT INTO milestone(id, project_id, name, due_date) VALUES ('milestone', 'project', 'Beta', '2026-10-31');
        INSERT INTO task(id, project_id, title, milestone_id) VALUES ('task', 'project', 'Preserved task', 'milestone');
      `);
      const db = drizzle(client);
      await client.query(
        "INSERT INTO drizzle.__drizzle_migrations(hash, created_at) VALUES ('unknown-history', 1791878252276)",
      );
      await expect(reconcileMilestoneMigration(db)).rejects.toThrow();
      expect(
        (
          await client.query(
            "SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations WHERE created_at = 1791878252275",
          )
        ).rows[0].count,
      ).toBe(1);
      await client.query(
        "DELETE FROM drizzle.__drizzle_migrations WHERE hash = 'unknown-history'",
      );
      await reconcileMilestoneMigration(db);
      await migrate(db, { migrationsFolder });
      await reconcileMilestoneMigration(db);
      await migrate(db, { migrationsFolder });
      expect(
        (
          await client.query(
            "SELECT name, due_date::text, is_current FROM milestone",
          )
        ).rows,
      ).toEqual([{ name: "Beta", due_date: "2026-10-31", is_current: false }]);
      expect(
        (await client.query("SELECT title, milestone_id FROM task")).rows,
      ).toEqual([{ title: "Preserved task", milestone_id: "milestone" }]);
      expect(
        (
          await client.query(
            "SELECT to_regclass('custom_field_definition')::text AS custom_fields, to_regclass('storage_cleanup')::text AS storage_cleanup",
          )
        ).rows[0],
      ).toEqual({
        custom_fields: "custom_field_definition",
        storage_cleanup: "storage_cleanup",
      });
      expect(
        (
          await client.query(
            "SELECT hash FROM drizzle.__drizzle_migrations ORDER BY id",
          )
        ).rows.map((row) => row.hash),
      ).toEqual(migrations.map((migration) => migration.hash));
    });
  });

  it("upgrades upstream's 0059 history and remains idempotent", async () => {
    await withUpgradeDatabase(async (client) => {
      await applyHistory(client, 60);
      const db = drizzle(client);
      await reconcileMilestoneMigration(db);
      await migrate(db, { migrationsFolder });
      await reconcileMilestoneMigration(db);
      await migrate(db, { migrationsFolder });
      expect(
        (
          await client.query(
            "SELECT to_regclass('milestone')::text AS table_name",
          )
        ).rows[0].table_name,
      ).toBe("milestone");
      expect(
        (
          await client.query(
            "SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations",
          )
        ).rows[0].count,
      ).toBe(migrations.length);
    });
  });
});
