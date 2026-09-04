import { eq, sql } from "drizzle-orm";
import { Client } from "pg";
import { beforeEach, describe, expect, it } from "vitest";
import db, { getDatabasePool, schema } from "../../apps/api/src/database";
import { withUtcDatabaseSession } from "../../apps/api/src/database/utc-connection-string";
import { createApp } from "../../apps/api/src/index";
import { withJobLease } from "../../apps/api/src/scheduler/leader-lock";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

describe("API integration: UTC timestamps", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("uses UTC on every pool connection and overrides a Seoul startup option", async () => {
    const clients = await Promise.all([
      getDatabasePool().connect(),
      getDatabasePool().connect(),
    ]);
    try {
      for (const client of clients) {
        const result = await client.query("SHOW timezone");
        expect(result.rows[0].TimeZone).toBe("UTC");
      }
    } finally {
      for (const client of clients) client.release();
    }

    const url = new URL(process.env.DATABASE_URL ?? "");
    url.searchParams.set("options", "-c timezone=Asia/Seoul");
    const client = new Client({
      connectionString: withUtcDatabaseSession(url.toString()),
    });
    await client.connect();
    try {
      expect((await client.query("SHOW timezone")).rows[0].TimeZone).toBe(
        "UTC",
      );
    } finally {
      await client.end();
    }
  });

  it("returns a new comment at the current instant and preserves it on read and edit", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        number: 1,
        title: "Comment clock",
      })
      .returning();
    mockAuthenticatedSession(member.user);
    const app = createApp().app;
    const before = Date.now();
    const response = await app.request("/api/activity/comment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, comment: "Just posted" }),
    });
    expect(response.status).toBe(200);
    const comment = await response.json();
    expect(comment.createdAt).toMatch(/Z$/);
    expect(Date.parse(comment.createdAt)).toBeGreaterThanOrEqual(before - 1000);
    expect(Date.parse(comment.createdAt)).toBeLessThanOrEqual(
      Date.now() + 1000,
    );

    const feed = await app.request(`/api/activity/${task.id}`);
    expect(feed.status).toBe(200);
    expect(await feed.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: comment.id,
          createdAt: comment.createdAt,
        }),
      ]),
    );

    const updated = await app.request("/api/activity/comment", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityId: comment.id, comment: "Edited" }),
    });
    expect(updated.status).toBe(200);
    const edited = await updated.json();
    expect(edited.createdAt).toBe(comment.createdAt);
    expect(Date.parse(edited.updatedAt)).toBeGreaterThanOrEqual(before - 1000);
    expect(Date.parse(edited.updatedAt)).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it("keeps database defaults, explicit dates and deadline comparisons on the same clock", async () => {
    const before = Date.now();
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const dueDate = new Date(Date.now() + 60 * 60 * 1000);
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        number: 1,
        title: "Date round trip",
        dueDate,
      })
      .returning();
    const [notification] = await db
      .insert(schema.notificationTable)
      .values({
        userId: member.user.id,
        type: "info",
      })
      .returning();
    for (const created of [member.user, project, task, notification]) {
      expect(created.createdAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
      expect(created.createdAt.getTime()).toBeLessThanOrEqual(
        Date.now() + 1000,
      );
    }
    expect(task.dueDate).toEqual(dueDate);
    const [deadline] = await db
      .select({
        overdue: sql<boolean>`${schema.taskTable.dueDate} < now()`,
      })
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, task.id));
    expect(deadline.overdue).toBe(false);

    const startTime = new Date("2026-09-05T08:00:00+09:00");
    const endTime = new Date("2026-09-05T09:00:00+09:00");
    const [entry] = await db
      .insert(schema.timeEntryTable)
      .values({
        taskId: task.id,
        userId: member.user.id,
        startTime,
        endTime,
        duration: 3600,
      })
      .returning();
    expect(entry.startTime.toISOString()).toBe("2026-09-04T23:00:00.000Z");
    expect(entry.endTime?.toISOString()).toBe("2026-09-05T00:00:00.000Z");
  });

  it("stores a raw SQL lease expiry in UTC even when Node runs in Seoul", async () => {
    const before = Date.now();
    await withJobLease(
      "timezone-test",
      async () => {
        const lease = await db.query.jobLeaseTable.findFirst({
          where: eq(schema.jobLeaseTable.name, "timezone-test"),
        });
        expect(lease?.expiresAt.getTime()).toBeGreaterThanOrEqual(
          before + 60_000,
        );
        expect(lease?.expiresAt.getTime()).toBeLessThanOrEqual(
          Date.now() + 60_000,
        );
      },
      () => {
        throw new Error("Unexpected held lease");
      },
      60_000,
    );
  });
});
