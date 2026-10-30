import type { WSContext } from "hono/ws";
import {
  addConnection,
  removeConnection,
  initializeWebSocketAdapter,
  shutdownWebSocketAdapter,
} from "../../apps/api/src/ws";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { DEFAULT_BUG_TEMPLATE } from "../../apps/api/src/bug/default-template";
import * as events from "../../apps/api/src/events";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

async function fixture(role = "admin") {
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
      headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  return { member, project, request, app, base };
}

describe("API integration: isolated project bugs", () => {
  beforeEach(resetTestDatabase);
  it("allows selecting, changing and clearing a workspace reporter", async () => {
    const { member, request } = await fixture();
    const other = await createWorkspaceMember({ userName: "Reporter" });
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: member.workspace.id,
      userId: other.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    const created = await request("", "POST", {
      title: "Reported on behalf",
      reporterId: other.user.id,
    });
    expect(created.status).toBe(200);
    const bug = await created.json();
    expect(bug.reporter).toMatchObject({ id: other.user.id, name: "Reporter" });
    expect(
      await (
        await request(`/${bug.id}`, "PATCH", { reporterId: member.user.id })
      ).json(),
    ).toMatchObject({ reporterId: member.user.id });
    expect(
      await (await request(`/${bug.id}`, "PATCH", { reporterId: null })).json(),
    ).toMatchObject({ reporterId: null, reporter: null });
    expect(await (await request(`/${bug.id}`)).json()).toMatchObject({
      reporterId: null,
    });
  });
  it("combines people filters across all states before pagination and counts unassigned reports", async () => {
    const { member, project, request } = await fixture();
    const [first, second, third] = await db
      .insert(schema.bugTable)
      .values([
        {
          projectId: project.id,
          title: "One",
          reporterId: member.user.id,
          fixerId: member.user.id,
          status: "new" as const,
        },
        {
          projectId: project.id,
          title: "Two",
          reporterId: member.user.id,
          fixerId: member.user.id,
          verifierId: member.user.id,
          status: "resolved" as const,
        },
        {
          projectId: project.id,
          title: "Three",
          status: "in-progress" as const,
        },
      ])
      .returning();
    const page = await (
      await request(
        `?reporterId=${member.user.id}&fixerId=${member.user.id}&limit=1&page=2`,
      )
    ).json();
    expect(page.pagination).toMatchObject({ total: 2, totalPages: 2, page: 2 });
    expect(page.data).toHaveLength(1);
    expect(page.data[0]).not.toHaveProperty("description");
    const combinations = [
      [`?reporterId=${member.user.id}&verifierId=none`, first.id],
      [
        `?status=resolved&fixerId=${member.user.id}&verifierId=${member.user.id}`,
        second.id,
      ],
      ["?reporterId=none&fixerId=none&verifierId=none", third.id],
    ];
    for (const [query, id] of combinations)
      expect(
        (await (await request(query)).json()).data.map(
          (bug: { id: string }) => bug.id,
        ),
      ).toEqual([id]);
    expect(
      (await (await request("?fixerId=outside-user")).json()).pagination.total,
    ).toBe(0);
    expect((await (await request()).json()).pagination.total).toBe(3);
  });
  it("matches multiple people or unassigned within a role, ANDs roles, and scopes counts to the project", async () => {
    const { member, project, request } = await fixture();
    const other = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: member.workspace.id,
      userId: other.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    const { project: otherProject } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    await db.insert(schema.bugTable).values([
      {
        projectId: project.id,
        title: "Alice",
        fixerId: member.user.id,
        verifierId: member.user.id,
      },
      { projectId: project.id, title: "Bob", fixerId: other.user.id },
      { projectId: project.id, title: "Unassigned" },
      {
        projectId: otherProject.id,
        title: "Outside project",
        fixerId: other.user.id,
      },
    ]);
    const ids = `${member.user.id},${other.user.id}`;
    const page = await (await request(`?fixerId=${ids}&limit=1&page=2`)).json();
    expect(page.pagination).toMatchObject({ total: 2, totalPages: 2, page: 2 });
    expect(page.data).toHaveLength(1);
    const combined = await (
      await request(`?fixerId=${ids}&verifierId=none`)
    ).json();
    expect(combined.data.map((bug: { title: string }) => bug.title)).toEqual([
      "Bob",
    ]);
    const withUnassigned = await (await request(`?fixerId=${ids},none`)).json();
    expect(withUnassigned.pagination.total).toBe(3);
    for (const role of ["reporterId", "fixerId", "verifierId"]) {
      const result = await (await request(`?${role}=${ids},none`)).json();
      expect(result.pagination.total).toBe(3);
      expect((await request(`?${role}=a,,b`)).status).toBe(400);
    }
  });
  it("creates and links project milestones, retains closed links, and detaches bugs on milestone deletion", async () => {
    const { project, request, app } = await fixture();
    const milestoneRequest = (path: string, method: string, body?: unknown) =>
      app.request(`/api/milestone/${path}`, {
        method,
        headers: { "content-type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    const milestoneResponse = await milestoneRequest(
      `project/${project.id}`,
      "POST",
      { name: "Bug release" },
    );
    expect(milestoneResponse.status).toBe(200);
    const milestone = await milestoneResponse.json();
    const created = await request("", "POST", {
      title: "Milestone bug",
      milestoneId: milestone.id,
    });
    expect(created.status).toBe(200);
    const bug = await created.json();
    expect(bug.milestone).toMatchObject({
      id: milestone.id,
      name: "Bug release",
      status: "open",
    });
    expect(
      (await (await request(`?milestoneId=${milestone.id}`)).json()).pagination
        .total,
    ).toBe(1);
    expect(
      (await milestoneRequest(milestone.id, "PATCH", { status: "closed" }))
        .status,
    ).toBe(200);
    expect(
      (
        await request("", "POST", {
          title: "Closed",
          milestoneId: milestone.id,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(`/${bug.id}`, "PATCH", {
          milestoneId: milestone.id,
          title: "Retained",
        })
      ).status,
    ).toBe(200);
    expect((await milestoneRequest(milestone.id, "DELETE")).status).toBe(200);
    expect(await (await request(`/${bug.id}`)).json()).toMatchObject({
      milestoneId: null,
      milestone: null,
      title: "Retained",
    });
    expect(
      (await (await request("?milestoneId=none")).json()).pagination.total,
    ).toBe(1);
  });
  it("rejects milestones from another project and allows unlinking without deleting either record", async () => {
    const { member, project, request } = await fixture();
    const { project: otherProject } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const [own, other] = await db
      .insert(schema.milestoneTable)
      .values([
        { projectId: project.id, name: "Own" },
        { projectId: otherProject.id, name: "Other" },
      ])
      .returning();
    expect(
      (await request("", "POST", { title: "Wrong", milestoneId: other.id }))
        .status,
    ).toBe(400);
    const bug = await (await request("", "POST", { title: "Bug" })).json();
    expect(
      (await request(`/${bug.id}`, "PATCH", { milestoneId: other.id })).status,
    ).toBe(400);
    expect(
      (await request(`/${bug.id}`, "PATCH", { milestoneId: own.id })).status,
    ).toBe(200);
    expect(
      (await request(`/${bug.id}`, "PATCH", { milestoneId: null })).status,
    ).toBe(200);
    expect(await (await request(`/${bug.id}`)).json()).toMatchObject({
      milestoneId: null,
      milestone: null,
    });
    await expect(
      db
        .update(schema.bugTable)
        .set({ milestoneId: other.id })
        .where(eq(schema.bugTable.id, bug.id)),
    ).rejects.toThrow();
  });
  it("records the authenticated reporter, assigns workspace members and permits unassignment", async () => {
    const { member, request } = await fixture();
    const fixer = await createWorkspaceMember({ userName: "Fixer" });
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: member.workspace.id,
      userId: fixer.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    const created = await request("", "POST", {
      title: "People",
      fixerId: fixer.user.id,
      verifierId: member.user.id,
    });
    expect(created.status).toBe(200);
    const bug = await created.json();
    expect(bug).toMatchObject({
      reporterId: member.user.id,
      fixerId: fixer.user.id,
      verifierId: member.user.id,
      reporter: { id: member.user.id, name: member.user.name },
      fixer: { id: fixer.user.id, name: "Fixer" },
      verifier: { id: member.user.id },
    });
    expect(Object.keys(bug.reporter).sort()).toEqual(["id", "image", "name"]);
    expect((await (await request("?status=new")).json()).data[0]).toMatchObject(
      { reporter: bug.reporter, fixer: bug.fixer, verifier: bug.verifier },
    );
    mockAuthenticatedSession(fixer.user);
    const edited = await request(`/${bug.id}`, "PATCH", {
      status: "resolved",
      fixerId: member.user.id,
      verifierId: fixer.user.id,
    });
    expect(edited.status).toBe(200);
    expect(await edited.json()).toMatchObject({
      reporterId: member.user.id,
      fixerId: member.user.id,
      verifierId: fixer.user.id,
    });
    const cleared = await request(`/${bug.id}`, "PATCH", {
      fixerId: null,
      verifierId: null,
    });
    expect(cleared.status).toBe(200);
    expect(await cleared.json()).toMatchObject({
      reporterId: member.user.id,
      fixerId: null,
      verifierId: null,
      fixer: null,
      verifier: null,
    });
  });
  it("rejects people assignments outside the project workspace", async () => {
    const { member, request } = await fixture();
    const outsider = await createWorkspaceMember();
    for (const input of [
      { reporterId: outsider.user.id },
      { fixerId: outsider.user.id },
      { verifierId: outsider.user.id },
      { fixerId: "missing" },
    ]) {
      expect(
        (await request("", "POST", { title: "Invalid", ...input })).status,
      ).toBe(400);
    }
    const bug = await (
      await request("", "POST", { title: "Valid", fixerId: member.user.id })
    ).json();
    for (const input of [
      { reporterId: outsider.user.id },
      { fixerId: outsider.user.id },
      { verifierId: outsider.user.id },
    ]) {
      expect((await request(`/${bug.id}`, "PATCH", input)).status).toBe(400);
    }
    expect(await (await request(`/${bug.id}`)).json()).toMatchObject({
      reporterId: member.user.id,
      fixerId: member.user.id,
      verifierId: null,
    });
  });
  it("requires assignment permission for assigning and clearing all roles without blocking ordinary edits", async () => {
    const { member, request } = await fixture("member");
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: member.workspace.id,
      role: "member",
      permission: JSON.stringify({
        project: ["read"],
        task: ["read", "create", "update"],
      }),
    });
    const bug = await (
      await request("", "POST", { title: "Unassigned" })
    ).json();
    for (const input of [
      { reporterId: member.user.id },
      { reporterId: null },
      { fixerId: member.user.id },
      { verifierId: member.user.id },
      { fixerId: null },
      { verifierId: null },
    ]) {
      expect(
        (await request("", "POST", { title: "Denied", ...input })).status,
      ).toBe(403);
      expect((await request(`/${bug.id}`, "PATCH", input)).status).toBe(403);
    }
    expect(
      (await request(`/${bug.id}`, "PATCH", { description: "Still editable" }))
        .status,
    ).toBe(200);
  });
  it("keeps legacy reports readable and preserves bugs when associated accounts are deleted", async () => {
    const { member, project, request } = await fixture();
    const [legacy] = await db
      .insert(schema.bugTable)
      .values({ projectId: project.id, title: "Legacy" })
      .returning();
    expect(await (await request(`/${legacy.id}`)).json()).toMatchObject({
      reporter: null,
      fixer: null,
      verifier: null,
    });
    const person = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: member.workspace.id,
      userId: person.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    mockAuthenticatedSession(person.user);
    const bug = await (
      await request("", "POST", {
        title: "Preserved",
        fixerId: person.user.id,
        verifierId: person.user.id,
      })
    ).json();
    mockAuthenticatedSession(member.user);
    await db
      .delete(schema.userTable)
      .where(eq(schema.userTable.id, person.user.id));
    expect(await (await request(`/${bug.id}`)).json()).toMatchObject({
      title: "Preserved",
      reporterId: null,
      fixerId: null,
      verifierId: null,
      reporter: null,
      fixer: null,
      verifier: null,
    });
  });
  it("creates in New, persists reports, moves through all stages and reopens without creating tasks", async () => {
    const { project, request } = await fixture();
    const publish = vi.spyOn(events, "publishEvent");
    const response = await request("", "POST", { title: "  Broken button  " });
    expect(response.status).toBe(200);
    const bug = await response.json();
    expect(bug).toMatchObject({
      projectId: project.id,
      title: "Broken button",
      status: "new",
      description: DEFAULT_BUG_TEMPLATE,
    });
    expect(publish).toHaveBeenCalledWith("bug.changed", {
      projectId: project.id,
    });
    for (const status of ["in-progress", "resolved", "new"]) {
      const updated = await request(`/${bug.id}`, "PATCH", {
        status,
        description: "Reproduction steps",
      });
      expect(updated.status).toBe(200);
      expect(await updated.json()).toMatchObject({
        status,
        description: "Reproduction steps",
      });
      const list = await request(`?status=${status}`);
      expect(
        (await list.json()).data.map((item: { id: string }) => item.id),
      ).toEqual([bug.id]);
    }
    expect(
      await db
        .select()
        .from(schema.taskTable)
        .where(eq(schema.taskTable.projectId, project.id)),
    ).toEqual([]);
    const [stored] = await db
      .select()
      .from(schema.projectTable)
      .where(eq(schema.projectTable.id, project.id));
    expect(stored.lastTaskNumber).toBe(0);
    expect((await request(`/${bug.id}`, "DELETE")).status).toBe(200);
    expect((await request(`/${bug.id}`)).status).toBe(404);
  });
  it("uses the current project template only for new reports and supports restoring defaults", async () => {
    const { project, member, request, app } = await fixture();
    const original = await (
      await request("", "POST", { title: "Before" })
    ).json();
    expect(
      (
        await request("/template", "PUT", {
          template: "## Custom reproduction\n1. ",
        })
      ).status,
    ).toBe(200);
    const next = await (await request("", "POST", { title: "After" })).json();
    expect(next.description).toBe("## Custom reproduction\n1.");
    expect((await (await request(`/${original.id}`)).json()).description).toBe(
      DEFAULT_BUG_TEMPLATE,
    );
    const { project: other } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    expect(
      (
        await (
          await app.request(`/api/bug/project/${other.id}/template`)
        ).json()
      ).template,
    ).toBe(DEFAULT_BUG_TEMPLATE);
    expect(
      await (await request("/template", "PUT", { template: null })).json(),
    ).toEqual({ template: DEFAULT_BUG_TEMPLATE, isDefault: true });
    expect((await (await request(`/${next.id}`)).json()).description).toBe(
      next.description,
    );
    await db
      .delete(schema.projectTable)
      .where(eq(schema.projectTable.id, project.id));
    expect(await db.select().from(schema.bugTable)).toEqual([]);
    expect(await db.select().from(schema.bugTemplateTable)).toEqual([]);
  });
  it("rejects hierarchy, task references, invalid statuses, blank templates and unbounded inputs", async () => {
    const { request } = await fixture();
    for (const body of [
      { title: " " },
      { title: "Bug", parentId: "task" },
      { title: "Bug", status: "resolved" },
      { title: "Bug", description: "x".repeat(50001) },
    ]) {
      expect((await request("", "POST", body)).status).toBe(400);
    }
    const bug = await (await request("", "POST", { title: "Valid" })).json();
    for (const body of [
      {},
      { parentId: "task" },
      { projectId: "elsewhere" },
      { status: "done" },
      { title: " " },
    ]) {
      expect((await request(`/${bug.id}`, "PATCH", body)).status).toBe(400);
    }
    expect((await request("/template", "PUT", { template: " " })).status).toBe(
      400,
    );
    for (const query of [
      "?status=done",
      "?status=new&page=0",
      "?status=new&limit=101",
    ])
      expect((await request(query)).status).toBe(400);
    await expect(
      db
        .update(schema.bugTable)
        .set({ status: "done" as "new" })
        .where(eq(schema.bugTable.id, bug.id)),
    ).rejects.toThrow();
  });
  it("scopes every mutation to its path project, including query/body spoofing", async () => {
    const { request, app, member } = await fixture();
    const other = await createWorkspaceMember();
    const { project: privateProject } = await createProjectFixture({
      workspaceId: other.workspace.id,
    });
    const [privateBug] = await db
      .insert(schema.bugTable)
      .values({ projectId: privateProject.id, title: "Private" })
      .returning();
    for (const [method, body] of [
      ["GET", undefined],
      ["PATCH", { title: "stolen" }],
      ["DELETE", undefined],
    ] as const) {
      expect(
        (
          await request(
            `/${privateBug.id}?workspaceId=${member.workspace.id}`,
            method,
            body,
          )
        ).status,
      ).toBe(404);
    }
    expect(
      (
        await app.request(
          `/api/bug/project/${privateProject.id}?status=new&workspaceId=${member.workspace.id}`,
        )
      ).status,
    ).toBe(403);
    expect(
      (await app.request(`/api/bug/project/${privateProject.id}/template`))
        .status,
    ).toBe(403);
    expect(
      (
        await db
          .select()
          .from(schema.bugTable)
          .where(eq(schema.bugTable.id, privateBug.id))
      )[0].title,
    ).toBe("Private");
    mockAnonymousSession();
    expect((await request("?status=new")).status).toBe(401);
  });
  it("enforces viewer and customized permissions independently for bugs and templates", async () => {
    const { request, project, member } = await fixture("viewer");
    const [bug] = await db
      .insert(schema.bugTable)
      .values({ projectId: project.id, title: "Read only" })
      .returning();
    expect((await request("?status=new")).status).toBe(200);
    expect((await request(`/${bug.id}`)).status).toBe(200);
    expect((await request("", "POST", { title: "Denied" })).status).toBe(403);
    expect(
      (await request(`/${bug.id}`, "PATCH", { status: "resolved" })).status,
    ).toBe(403);
    expect((await request(`/${bug.id}`, "DELETE")).status).toBe(403);
    expect(
      (await request("/template", "PUT", { template: "Denied" })).status,
    ).toBe(403);
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: member.workspace.id,
      role: "viewer",
      permission: JSON.stringify({
        project: ["read", "update"],
        task: ["read", "update"],
      }),
    });
    expect(
      (await request(`/${bug.id}`, "PATCH", { status: "resolved" })).status,
    ).toBe(200);
    expect(
      (await request("/template", "PUT", { template: "Allowed" })).status,
    ).toBe(200);
    expect((await request("", "POST", { title: "Still denied" })).status).toBe(
      403,
    );
  });
  it("limits API keys to their task and project scopes", async () => {
    const { member, app, base } = await fixture();
    const token = "bug-read-only-test-key";
    await db.insert(schema.apikeyTable).values({
      referenceId: member.user.id,
      userId: member.user.id,
      key: createHash("sha256").update(token).digest("base64url"),
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      permissions: JSON.stringify({ project: ["read"], task: ["read"] }),
    });
    const headers = {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    };
    expect((await app.request(base + "?status=new", { headers })).status).toBe(
      200,
    );
    expect(
      (
        await app.request(base, {
          method: "POST",
          headers,
          body: JSON.stringify({ title: "Denied" }),
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await app.request(base + "/template", {
          method: "PUT",
          headers,
          body: JSON.stringify({ template: "Denied" }),
        })
      ).status,
    ).toBe(403);
  });
  it("paginates each status separately and excludes report bodies from lists", async () => {
    const { request, project } = await fixture();
    await db.insert(schema.bugTable).values(
      Array.from({ length: 4 }, (_, index) => ({
        id: `bug-${index}`,
        projectId: project.id,
        title: `Bug ${index}`,
        description: "large report",
        status: index === 3 ? ("resolved" as const) : ("new" as const),
      })),
    );
    const first = await (await request("?status=new&limit=2&page=1")).json();
    const second = await (await request("?status=new&limit=2&page=2")).json();
    expect(first.pagination).toEqual({
      total: 3,
      page: 1,
      pageSize: 2,
      totalPages: 2,
    });
    expect(second.data).toHaveLength(1);
    expect(
      new Set(
        [...first.data, ...second.data].map((bug: { id: string }) => bug.id),
      ).size,
    ).toBe(3);
    expect(first.data[0]).not.toHaveProperty("description");
  });
  it("delivers bug and template invalidations only to the matching project without Redis", async () => {
    const { project, member, request } = await fixture();
    const { project: other } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    await initializeWebSocketAdapter();
    const socket = { send: vi.fn(), close: vi.fn() };
    const otherSocket = { send: vi.fn(), close: vi.fn() };
    const connection = addConnection(
      project.id,
      socket as unknown as WSContext,
      member.user.id,
      "another-window",
      member.workspace.id,
    );
    const otherConnection = addConnection(
      other.id,
      otherSocket as unknown as WSContext,
      member.user.id,
      "another-window",
      member.workspace.id,
    );
    try {
      await request("", "POST", { title: "Realtime" });
      await vi.waitFor(() =>
        expect(socket.send).toHaveBeenCalledWith(
          JSON.stringify({ type: "BUGS_UPDATED", projectId: project.id }),
        ),
      );
      socket.send.mockClear();
      await request("/template", "PUT", { template: "Updated template" });
      await vi.waitFor(() =>
        expect(socket.send).toHaveBeenCalledWith(
          JSON.stringify({
            type: "BUG_TEMPLATE_UPDATED",
            projectId: project.id,
          }),
        ),
      );
      expect(otherSocket.send).not.toHaveBeenCalled();
    } finally {
      removeConnection(project.id, connection);
      removeConnection(other.id, otherConnection);
      await shutdownWebSocketAdapter();
    }
  });
});
