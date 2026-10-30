import { eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

vi.mock("../../apps/api/src/events", async (original) => ({
  ...(await original<object>()),
  publishEvent: vi.fn(async () => undefined),
}));
beforeEach(async () => {
  await resetTestDatabase();
});

async function fixture() {
  const member = await createWorkspaceMember({
    role: "owner",
    userName: "Bug author",
  });
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
    slug: "QA",
  });
  mockAuthenticatedSession(member.user);
  const { app } = createApp();
  const feed = async () => {
    const response = await app.request(
      `/api/activity/workspace/${member.workspace.id}`,
    );
    expect(response.status).toBe(200);
    return response.json();
  };
  const request = (path: string, method: string, body?: unknown) =>
    app.request(`/api/bug/project/${project.id}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  return { member, project, app, feed, request };
}

it("shows bug creation and edits with actor, project and the current Bug link target, without large history payloads", async () => {
  const { member, project, feed, request } = await fixture();
  const created = await request("", "POST", {
    title: "Original bug",
    description: "x".repeat(30000),
  });
  expect(created.status).toBe(200);
  const bug = await created.json();
  expect(
    (
      await request(`/${bug.id}`, "PATCH", {
        title: "Updated bug",
        status: "resolved",
        description: "y".repeat(30000),
      })
    ).status,
  ).toBe(200);
  const rows = await feed();
  expect(rows.map((row: { type: string }) => row.type)).toEqual([
    "bug_updated",
    "bug_created",
  ]);
  expect(rows[0]).toMatchObject({
    resourceType: "bug",
    bugId: bug.id,
    bugTitle: "Updated bug",
    projectId: project.id,
    projectSlug: "QA",
    userId: member.user.id,
    userName: "Bug author",
    excerpt: null,
  });
  expect(rows[0]).not.toHaveProperty("taskId");
  expect(rows[0]).not.toHaveProperty("content");
  expect(rows[0]).not.toHaveProperty("changes");
  expect(JSON.stringify(rows).length).toBeLessThan(3000);
  // A no-op Bug save should not add a home activity.
  await request(`/${bug.id}`, "PATCH", { title: "Updated bug" });
  expect(await feed()).toHaveLength(2);
});

it("shows current comment text at its edit time, including edits of old comments, and removes deleted comments", async () => {
  const { feed, request } = await fixture();
  const bug = await (
    await request("", "POST", { title: "Comment target" })
  ).json();
  const created = await request(`/${bug.id}/comments`, "POST", {
    content: "Original comment",
  });
  expect(created.status).toBe(200);
  const comment = await created.json();
  expect((await feed())[0]).toMatchObject({
    type: "bug_comment_created",
    excerpt: "Original comment",
  });
  const old = new Date(Date.now() - 45 * 86400000);
  await db
    .update(schema.bugCommentTable)
    .set({ createdAt: old, updatedAt: old })
    .where(eq(schema.bugCommentTable.id, comment.id));
  expect(
    (await feed()).some((row: { type: string }) =>
      row.type.startsWith("bug_comment"),
    ),
  ).toBe(false);
  const edited = await request(`/${bug.id}/comments/${comment.id}`, "PATCH", {
    content: `Updated <b>proof</b> ${"a".repeat(500)}`,
  });
  expect(edited.status).toBe(200);
  const saved = await edited.json();
  const [activity] = await feed();
  expect(activity).toMatchObject({
    type: "bug_comment_updated",
    resourceType: "bug",
    bugId: bug.id,
    createdAt: saved.updatedAt,
  });
  expect(activity.excerpt).toHaveLength(240);
  expect(activity.excerpt.startsWith("Updated proof")).toBe(true);
  expect(activity).not.toHaveProperty("content");
  const noOp = await request(`/${bug.id}/comments/${comment.id}`, "PATCH", {
    content: saved.content,
  });
  expect((await noOp.json()).updatedAt).toBe(saved.updatedAt);
  expect(
    (await feed()).filter((row: { type: string }) =>
      row.type.startsWith("bug_comment"),
    ),
  ).toHaveLength(1);
  expect(
    (await request(`/${bug.id}/comments/${comment.id}`, "DELETE")).status,
  ).toBe(200);
  expect(
    (await feed()).some((row: { type: string }) =>
      row.type.startsWith("bug_comment"),
    ),
  ).toBe(false);
});

it("merges tasks, bug changes and comments into one bounded newest-first feed", async () => {
  const { member, project, feed } = await fixture();
  const [bug] = await db
    .insert(schema.bugTable)
    .values({ projectId: project.id, title: "Busy bug" })
    .returning();
  const [task] = await db
    .insert(schema.taskTable)
    .values({ projectId: project.id, title: "Existing Task", status: "to-do" })
    .returning();
  const now = Date.now();
  for (let i = 0; i < 12; i++) {
    const base = now - i * 10000;
    await db.insert(schema.activityTable).values({
      taskId: task.id,
      type: "comment",
      content: `Task ${i}`,
      createdAt: new Date(base),
    });
    await db.insert(schema.bugHistoryTable).values({
      bugId: bug.id,
      userId: member.user.id,
      type: "updated",
      changes: [],
      createdAt: new Date(base - 1000),
    });
    await db.insert(schema.bugCommentTable).values({
      bugId: bug.id,
      userId: member.user.id,
      content: `Bug comment ${i}`,
      createdAt: new Date(base - 2000),
      updatedAt: new Date(base - 2000),
    });
  }
  const rows = await feed();
  expect(rows).toHaveLength(20);
  expect(rows.slice(0, 3).map((row: { type: string }) => row.type)).toEqual([
    "comment",
    "bug_updated",
    "bug_comment_created",
  ]);
  expect(rows[0]).toMatchObject({
    resourceType: "task",
    taskId: task.id,
    taskTitle: "Existing Task",
  });
  expect(new Set(rows.map((row: { id: string }) => row.id)).size).toBe(20);
  const dates = rows.map((row: { createdAt: string }) =>
    Date.parse(row.createdAt),
  );
  expect(dates).toEqual([...dates].sort((a, b) => b - a));
});

it("excludes foreign, archived and deleted bugs, and follows the current project workspace", async () => {
  const { project, feed, app, request } = await fixture();
  const foreign = await createWorkspaceMember();
  const foreignProject = await createProjectFixture({
    workspaceId: foreign.workspace.id,
  });
  const [foreignBug] = await db
    .insert(schema.bugTable)
    .values({ projectId: foreignProject.project.id, title: "Private" })
    .returning();
  await db
    .insert(schema.bugHistoryTable)
    .values({ bugId: foreignBug.id, type: "created", changes: [] });
  await db
    .insert(schema.bugCommentTable)
    .values({ bugId: foreignBug.id, content: "Private comment" });
  expect(await feed()).toHaveLength(0);
  const bug = await (await request("", "POST", { title: "Local bug" })).json();
  await request(`/${bug.id}/comments`, "POST", { content: "Local comment" });
  expect(await feed()).toHaveLength(2);
  await db
    .update(schema.projectTable)
    .set({ archivedAt: new Date() })
    .where(eq(schema.projectTable.id, project.id));
  expect(await feed()).toHaveLength(0);
  await db
    .update(schema.projectTable)
    .set({ archivedAt: null, workspaceId: foreign.workspace.id })
    .where(eq(schema.projectTable.id, project.id));
  expect(await feed()).toHaveLength(0);
  mockAuthenticatedSession(foreign.user);
  const moved = await (
    await app.request(`/api/activity/workspace/${foreign.workspace.id}`)
  ).json();
  expect(
    moved.filter((row: { bugId: string }) => row.bugId === bug.id),
  ).toHaveLength(2);
  await db.delete(schema.bugTable).where(eq(schema.bugTable.id, bug.id));
  const deleted = await (
    await app.request(`/api/activity/workspace/${foreign.workspace.id}`)
  ).json();
  expect(deleted.some((row: { bugId: string }) => row.bugId === bug.id)).toBe(
    false,
  );
});
