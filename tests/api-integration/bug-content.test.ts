import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const storage = vi.hoisted(() => ({
  presign: vi.fn(),
  verify: vi.fn(),
  read: vi.fn(),
}));
vi.mock("../../apps/api/src/storage/s3", async (original) => ({
  ...(await original<typeof import("../../apps/api/src/storage/s3")>()),
  createTaskImageUploadUrl: storage.presign,
  verifyTaskAssetUpload: storage.verify,
  getPrivateObject: storage.read,
}));
beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  storage.presign.mockImplementation(async () => ({
    key: randomUUID(),
    uploadUrl: "https://storage.test/upload",
    headers: {},
  }));
  storage.verify.mockImplementation(async (_key, input) => ({
    contentType: input.contentType,
    size: input.size,
  }));
  storage.read.mockResolvedValue({
    body: new Uint8Array([1, 2, 3]),
    contentType: "image/png",
    contentLength: 3,
  });
});
async function fixture(role = "owner") {
  const member = await createWorkspaceMember({ role });
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  mockAuthenticatedSession(member.user);
  const { app } = createApp();
  const base = `/api/bug/project/${project.id}`;
  const request = (path = "", method = "GET", body?: unknown) =>
    app.request(base + path, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const upload = async (contentType: string, bugId?: string) => {
    const input = {
      filename:
        contentType === "image/png" ? "screenshot.png" : "recording.mp4",
      contentType,
      size: 12,
      bugId,
    };
    const staged = await request("/uploads", "POST", input);
    expect(staged.status).toBe(200);
    const { key } = await staged.json();
    const finalized = await request("/uploads/finalize", "POST", {
      ...input,
      key,
    });
    expect(finalized.status).toBe(200);
    return finalized.json();
  };
  return { member, project, app, request, upload };
}
it("records actual changes, actor and before/after Markdown without no-op history", async () => {
  const { request, member } = await fixture();
  const bug = await (
    await request("", "POST", {
      title: "Before",
      description: "## Steps\n- **Click**",
    })
  ).json();
  const changed = await request(`/${bug.id}`, "PATCH", {
    title: "After",
    description: "## Fixed\n- [x] Verified",
    status: "resolved",
    fixerId: member.user.id,
    verifierId: member.user.id,
    reporterId: null,
  });
  expect(changed.status).toBe(200);
  expect(
    (
      await request(`/${bug.id}`, "PATCH", {
        title: "After",
        status: "resolved",
      })
    ).status,
  ).toBe(200);
  const history = await (await request(`/${bug.id}/history`)).json();
  expect(history.pagination.total).toBe(2);
  expect(history.data[0]).toMatchObject({
    type: "updated",
    user: { id: member.user.id },
  });
  expect(history.data[0].changes).toEqual(
    expect.arrayContaining([
      {
        field: "description",
        before: "## Steps\n- **Click**",
        after: "## Fixed\n- [x] Verified",
      },
      { field: "status", before: "new", after: "resolved" },
      {
        field: "fixerId",
        before: null,
        after: member.user.id,
        beforeLabel: null,
        afterLabel: member.user.name,
      },
    ]),
  );
  expect(history.data[1].type).toBe("created");
  const detail = await (await request(`/${bug.id}`)).json();
  expect(detail.description).toBe("## Fixed\n- [x] Verified");
});
it("serializes simultaneous edits so every history entry has the preceding value", async () => {
  const { request } = await fixture();
  const bug = await (await request("", "POST", { title: "Original" })).json();
  const results = await Promise.all([
    request(`/${bug.id}`, "PATCH", { title: "First" }),
    request(`/${bug.id}`, "PATCH", { title: "Second" }),
  ]);
  expect(results.map((result) => result.status)).toEqual([200, 200]);
  const history = await (await request(`/${bug.id}/history`)).json();
  const changes = history.data
    .filter((entry: { type: string }) => entry.type === "updated")
    .map((entry: { changes: unknown[] }) => entry.changes[0]);
  expect(changes).toHaveLength(2);
  const first = changes.find(
    (change: { before: string }) => change.before === "Original",
  );
  const next = changes.find(
    (change: { before: string }) => change.before !== "Original",
  );
  expect(next.before).toBe(first.after);
});
it("claims staged image/video only at save and retains them for history until deletion", async () => {
  const { upload, request, app, member, project } = await fixture();
  const image = await upload("image/png");
  const video = await upload("video/mp4");
  expect(await db.query.bugTable.findMany()).toHaveLength(0);
  const description = `## Evidence\n![Screenshot](${image.url})\n<kaneo-attachment url="${video.url}" filename="recording.mp4" mime-type="video/mp4" size="12" />`;
  const created = await request("", "POST", { title: "Media", description });
  expect(created.status).toBe(200);
  const bug = await created.json();
  expect(
    (await db.query.assetTable.findMany()).every(
      (asset) =>
        asset.bugId === bug.id &&
        asset.surface === "bug-description" &&
        asset.taskId === null,
    ),
  ).toBe(true);
  expect(await db.query.taskTable.findMany()).toHaveLength(0);
  await db
    .update(schema.projectTable)
    .set({ isPublic: true })
    .where(eq(schema.projectTable.id, project.id));
  mockAnonymousSession();
  expect((await app.request(`/api/asset/${image.id}`)).status).toBe(401);
  const outsider = await createWorkspaceMember();
  mockAuthenticatedSession(outsider.user);
  expect((await app.request(`/api/asset/${image.id}`)).status).toBe(403);
  expect((await request(`/${bug.id}/history`)).status).toBe(403);
  mockAuthenticatedSession(member.user);
  expect((await app.request(`/api/asset/${image.id}`)).status).toBe(200);
  expect(
    (await request(`/${bug.id}`, "PATCH", { description: "Removed media" }))
      .status,
  ).toBe(200);
  expect(await db.query.assetTable.findMany()).toHaveLength(2);
  const history = await (await request(`/${bug.id}/history`)).json();
  expect(history.data[0].changes[0].before).toBe(description);
  const extra = await upload("image/png", bug.id);
  expect(
    (
      await request(`/${bug.id}`, "PATCH", {
        description: `![New](${extra.url})`,
      })
    ).status,
  ).toBe(200);
  expect((await request(`/${bug.id}`, "DELETE")).status).toBe(200);
  expect(await db.query.assetTable.findMany()).toHaveLength(0);
  expect(await db.query.bugHistoryTable.findMany()).toHaveLength(0);
  expect(await db.query.storageCleanupTable.findMany()).toHaveLength(3);
});
it("rejects another owner's upload and unfinished uploads without partial bugs or history", async () => {
  const { member, project, request } = await fixture();
  const other = await createWorkspaceMember();
  for (const [surface, createdBy] of [
    ["draft", other.user.id],
    ["draft-pending", member.user.id],
  ]) {
    const [asset] = await db
      .insert(schema.assetTable)
      .values({
        projectId: project.id,
        workspaceId: member.workspace.id,
        objectKey: randomUUID(),
        filename: "x.png",
        mimeType: "image/png",
        size: 12,
        surface,
        createdBy,
      })
      .returning();
    expect(
      (
        await request("", "POST", {
          title: "Invalid",
          description: `![x](/api/asset/${asset.id})`,
        })
      ).status,
    ).toBe(400);
  }
  expect(await db.query.bugTable.findMany()).toHaveLength(0);
  expect(await db.query.bugHistoryTable.findMany()).toHaveLength(0);
});
it("enforces create versus update upload permission and rejects a bug from another project", async () => {
  const { request, project, member } = await fixture("bug-editor");
  await db.insert(schema.workspaceRoleTable).values({
    workspaceId: member.workspace.id,
    role: "bug-editor",
    permission: JSON.stringify({
      task: ["read", "update"],
      project: ["read"],
    }),
  });
  const [bug] = await db
    .insert(schema.bugTable)
    .values({ projectId: project.id, title: "Existing" })
    .returning();
  const input = { filename: "image.png", contentType: "image/png", size: 12 };
  expect((await request("/uploads", "POST", input)).status).toBe(403);
  expect(
    (await request("/uploads", "POST", { ...input, bugId: bug.id })).status,
  ).toBe(200);
  const otherProject = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const [otherBug] = await db
    .insert(schema.bugTable)
    .values({ projectId: otherProject.project.id, title: "Other" })
    .returning();
  expect(
    (await request("/uploads", "POST", { ...input, bugId: otherBug.id }))
      .status,
  ).toBe(404);
  expect((await request(`/${otherBug.id}/history`)).status).toBe(404);
});
it("blocks viewer uploads and verifies storage before accepting finalization", async () => {
  const { request, member, project } = await fixture();
  const input = { filename: "image.png", contentType: "image/png", size: 12 };
  const staged = await (await request("/uploads", "POST", input)).json();
  const { InvalidUploadedAssetError } =
    await import("../../apps/api/src/storage/s3");
  storage.verify.mockRejectedValueOnce(
    new InvalidUploadedAssetError("Wrong bytes"),
  );
  expect(
    (await request("/uploads/finalize", "POST", { ...input, key: staged.key }))
      .status,
  ).toBe(400);
  await db
    .update(schema.workspaceUserTable)
    .set({ role: "viewer" })
    .where(eq(schema.workspaceUserTable.userId, member.user.id));
  const [bug] = await db
    .insert(schema.bugTable)
    .values({ projectId: project.id, title: "Read only" })
    .returning();
  for (const suffix of ["", "/finalize"]) {
    expect(
      (
        await request(`/uploads${suffix}`, "POST", {
          ...input,
          bugId: bug.id,
          ...(suffix ? { key: staged.key } : {}),
        })
      ).status,
    ).toBe(403);
  }
  expect((await request(`/${bug.id}/history`)).status).toBe(200);
});
it("records shared milestone deletion and paginates history without exposing another project", async () => {
  const { request, app, project } = await fixture();
  const [milestone] = await db
    .insert(schema.milestoneTable)
    .values({ projectId: project.id, name: "Release" })
    .returning();
  const bug = await (
    await request("", "POST", { title: "Milestone", milestoneId: milestone.id })
  ).json();
  expect(
    (await app.request(`/api/milestone/${milestone.id}`, { method: "DELETE" }))
      .status,
  ).toBe(200);
  const history = await (await request(`/${bug.id}/history`)).json();
  expect(history.data[0].changes[0]).toMatchObject({
    field: "milestoneId",
    beforeLabel: "Release",
    after: null,
  });
  await db.insert(schema.bugHistoryTable).values(
    Array.from({ length: 20 }, () => ({
      bugId: bug.id,
      type: "updated" as const,
      changes: [],
    })),
  );
  const page = await (await request(`/${bug.id}/history?page=2`)).json();
  expect(page.data).toHaveLength(2);
  expect(page.pagination.totalPages).toBe(2);
});
