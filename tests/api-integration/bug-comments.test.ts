import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { publishEvent } from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

vi.mock("../../apps/api/src/events", async (original) => ({
  ...(await original<object>()),
  publishEvent: vi.fn(async () => undefined),
}));
vi.mock("../../apps/api/src/storage/s3", async (original) => ({
  ...(await original<object>()),
  getPrivateObject: vi.fn(async () => ({
    body: new Uint8Array([1]),
    contentType: "image/png",
    contentLength: 1,
  })),
}));
beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
});

async function fixture() {
  const member = await createWorkspaceMember({ role: "owner" });
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const [bug] = await db
    .insert(schema.bugTable)
    .values({
      projectId: project.id,
      title: "Comment test",
      reporterId: member.user.id,
    })
    .returning();
  mockAuthenticatedSession(member.user);
  const { app } = createApp();
  const base = `/api/bug/project/${project.id}/${bug.id}/comments`;
  const request = (path = "", method = "GET", body?: unknown) =>
    app.request(base + path, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const draft = async (mimeType = "image/png", overrides = {}) => {
    const [asset] = await db
      .insert(schema.assetTable)
      .values({
        workspaceId: member.workspace.id,
        projectId: project.id,
        createdBy: member.user.id,
        objectKey: randomUUID(),
        filename: mimeType === "image/png" ? "screenshot.png" : "recording.mp4",
        mimeType,
        size: 1,
        surface: "draft",
        ...overrides,
      })
      .returning();
    return { ...asset, url: `/api/asset/${asset.id}` };
  };
  return { member, project, bug, app, base, request, draft };
}

it("creates, lists, edits and deletes Markdown comments separately from tasks and bug details", async () => {
  const { request, bug, project, member } = await fixture();
  const response = await request("", "POST", {
    content: "## Verification\n- **Works**",
  });
  expect(response.status).toBe(200);
  const comment = await response.json();
  expect(comment).toMatchObject({
    bugId: bug.id,
    userId: member.user.id,
    user: { id: member.user.id, name: member.user.name },
    content: "## Verification\n- **Works**",
  });
  expect((await (await request()).json()).data).toHaveLength(1);
  const edit = await request(`/${comment.id}`, "PATCH", { content: "Updated" });
  expect(edit.status).toBe(200);
  expect((await edit.json()).updatedAt).not.toBe(comment.updatedAt);
  expect(
    (
      await db.query.bugTable.findFirst({
        where: eq(schema.bugTable.id, bug.id),
      })
    )?.description,
  ).toBe("");
  expect(await db.query.activityTable.findMany()).toHaveLength(0);
  expect(await db.query.commentTable.findMany()).toHaveLength(0);
  expect((await request(`/${comment.id}`, "DELETE")).status).toBe(200);
  expect((await (await request()).json()).data).toHaveLength(0);
  expect(publishEvent).toHaveBeenCalledTimes(3);
  expect(publishEvent).toHaveBeenLastCalledWith("bug.comments.changed", {
    projectId: project.id,
    bugId: bug.id,
  });
});

it("rejects empty, oversized and spoofed-author input", async () => {
  const { request } = await fixture();
  for (const body of [
    { content: "  \n " },
    { content: "x".repeat(10001) },
    { content: "x", userId: "other" },
  ])
    expect((await request("", "POST", body)).status).toBe(400);
  expect(await db.query.bugCommentTable.findMany()).toHaveLength(0);
});

it("requires workspace membership and task:update while limiting edits/deletes to the author", async () => {
  const { request, member, bug, app, project } = await fixture();
  const comment = await (await request("", "POST", { content: "Mine" })).json();
  const other = await createWorkspaceMember();
  mockAuthenticatedSession(other.user);
  expect((await request()).status).toBe(403);
  expect((await request("", "POST", { content: "No" })).status).toBe(403);
  await db.insert(schema.workspaceUserTable).values({
    workspaceId: member.workspace.id,
    userId: other.user.id,
    role: "member",
    joinedAt: new Date(),
  });
  expect((await request()).status).toBe(200);
  expect(
    (await request(`/${comment.id}`, "PATCH", { content: "Stolen" })).status,
  ).toBe(404);
  expect((await request(`/${comment.id}`, "DELETE")).status).toBe(404);
  await db
    .update(schema.workspaceUserTable)
    .set({ role: "viewer" })
    .where(eq(schema.workspaceUserTable.userId, other.user.id));
  expect((await request()).status).toBe(200);
  expect((await request("", "POST", { content: "Viewer" })).status).toBe(403);
  expect(
    (
      await app.request(`/api/bug/project/${project.id}/uploads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bugId: bug.id,
          filename: "image.png",
          contentType: "image/png",
          size: 1,
        }),
      })
    ).status,
  ).toBe(403);
  mockAnonymousSession();
  expect((await request()).status).toBe(401);
});

it("scopes comment IDs to their bug and project", async () => {
  const { request, project, bug, member, app } = await fixture();
  const comment = await (
    await request("", "POST", { content: "Private" })
  ).json();
  const { project: second } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const [secondBug] = await db
    .insert(schema.bugTable)
    .values({ projectId: project.id, title: "Other" })
    .returning();
  for (const path of [
    `/api/bug/project/${second.id}/${bug.id}/comments`,
    `/api/bug/project/${project.id}/${secondBug.id}/comments/${comment.id}`,
  ]) {
    expect(
      (
        await app.request(path, {
          method: path.endsWith(comment.id) ? "DELETE" : "GET",
        })
      ).status,
    ).toBe(404);
  }
});

it("claims image/video drafts, preserves retained files and queues removed files for cleanup", async () => {
  const { request, draft, bug, app } = await fixture();
  const image = await draft();
  const video = await draft("video/mp4");
  const content = `![Proof](${image.url})\n<kaneo-attachment url="${video.url}" filename="recording.mp4" mime-type="video/mp4" />`;
  const created = await request("", "POST", { content });
  expect(created.status).toBe(200);
  const comment = await created.json();
  const assets = await db.query.assetTable.findMany();
  expect(assets).toHaveLength(2);
  expect(
    assets.every(
      (asset) =>
        asset.bugCommentId === comment.id &&
        asset.bugId === bug.id &&
        asset.surface === "bug-comment",
    ),
  ).toBe(true);
  expect((await app.request(image.url)).status).toBe(200);
  expect(
    (
      await request(`/${comment.id}`, "PATCH", {
        content: `![Proof](${image.url})`,
      })
    ).status,
  ).toBe(200);
  expect(await db.query.assetTable.findMany()).toHaveLength(1);
  expect(
    (await db.query.storageCleanupTable.findMany()).map((row) => row.objectKey),
  ).toEqual([video.objectKey]);
  expect((await request(`/${comment.id}`, "DELETE")).status).toBe(200);
  expect(await db.query.assetTable.findMany()).toHaveLength(0);
  expect(await db.query.storageCleanupTable.findMany()).toHaveLength(2);
});

it("rejects attachments from another author, comment, bug description or unfinished upload without partial writes", async () => {
  const { request, draft, app, project, bug } = await fixture();
  const other = await createWorkspaceMember();
  const foreign = await draft("image/png", { createdBy: other.user.id });
  const pending = await draft("image/png", { surface: "draft-pending" });
  const description = await draft("image/png", {
    bugId: bug.id,
    surface: "bug-description",
  });
  const first = await draft();
  const created = await request("", "POST", {
    content: `![First](${first.url})`,
  });
  expect(created.status).toBe(200);
  for (const asset of [foreign, pending, description, first]) {
    const own = await draft();
    expect(
      (
        await request("", "POST", {
          content: `![Own](${own.url})\n![Invalid](${asset.url})`,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await db.query.assetTable.findFirst({
          where: eq(schema.assetTable.id, own.id),
        })
      )?.bugId,
    ).toBeNull();
  }
  expect(
    (
      await app.request(`/api/bug/project/${project.id}/${bug.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: `![Comment](${first.url})` }),
      })
    ).status,
  ).toBe(400);
  expect(await db.query.bugCommentTable.findMany()).toHaveLength(1);
});

it("keeps comment attachments private on public projects and removes comments/assets with the bug", async () => {
  const { request, draft, member, project, bug, app } = await fixture();
  const image = await draft();
  await request("", "POST", { content: `![Private](${image.url})` });
  await db
    .update(schema.projectTable)
    .set({ isPublic: true })
    .where(eq(schema.projectTable.id, project.id));
  mockAnonymousSession();
  expect((await app.request(image.url)).status).toBe(401);
  const outsider = await createWorkspaceMember();
  mockAuthenticatedSession(outsider.user);
  expect((await app.request(image.url)).status).toBe(403);
  mockAuthenticatedSession(member.user);
  expect(
    (
      await app.request(`/api/bug/project/${project.id}/${bug.id}`, {
        method: "DELETE",
      })
    ).status,
  ).toBe(200);
  expect(await db.query.bugCommentTable.findMany()).toHaveLength(0);
  expect(await db.query.assetTable.findMany()).toHaveLength(0);
  expect(await db.query.storageCleanupTable.findMany()).toHaveLength(1);
});

it("paginates newest-first with a stable ID tiebreaker and preserves comments from deleted users", async () => {
  const { request, bug } = await fixture();
  const author = await createWorkspaceMember();
  await db.insert(schema.bugCommentTable).values(
    Array.from({ length: 21 }, (_, i) => ({
      id: `comment-${String(i).padStart(2, "0")}`,
      bugId: bug.id,
      userId: author.user.id,
      content: String(i),
      createdAt: new Date("2026-01-01T00:00:00Z"),
    })),
  );
  await db
    .delete(schema.userTable)
    .where(eq(schema.userTable.id, author.user.id));
  const first = await (await request()).json();
  const second = await (await request("?page=2")).json();
  expect(first.data).toHaveLength(20);
  expect(first.pagination).toEqual({ page: 1, total: 21, totalPages: 2 });
  expect(first.data[0]).toMatchObject({
    id: "comment-20",
    user: null,
    userId: null,
  });
  expect(second.data).toHaveLength(1);
  expect(second.data[0].id).toBe("comment-00");
  expect((await request("?page=0")).status).toBe(400);
});
