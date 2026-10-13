import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import {
  deleteMilestone,
  setTaskMilestones,
  updateMilestone,
} from "../../apps/api/src/milestone/controllers/milestones";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

async function fixture(role = "admin") {
  const member = await createWorkspaceMember({ role });
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const [milestone] = await db
    .insert(schema.milestoneTable)
    .values({ projectId: project.id, name: "Beta", dueDate: "2026-10-31" })
    .returning();
  mockAuthenticatedSession(member.user);
  const { app } = createApp();
  const request = (path: string, method = "GET", body?: unknown) =>
    app.request(path, {
      method,
      headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const seedTask = async (
    status = "to-do",
    milestoneId: string | null = milestone.id,
  ) => {
    const existing = await db
      .select({ id: schema.taskTable.id })
      .from(schema.taskTable)
      .where(eq(schema.taskTable.projectId, project.id));
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: `Task ${existing.length + 1}`,
        number: existing.length + 1,
        status,
        milestoneId,
      })
      .returning();
    return task;
  };
  return { member, project, columns, milestone, request, seedTask };
}

describe("API integration: project milestones", () => {
  beforeEach(resetTestDatabase);

  it("requires authentication", async () => {
    const { request, project } = await fixture();
    mockAnonymousSession();
    expect((await request(`/api/milestone/project/${project.id}`)).status).toBe(
      401,
    );
  });
  it("creates, edits, closes and reopens a milestone with a date-only contract", async () => {
    const { request, project } = await fixture();
    const response = await request(
      `/api/milestone/project/${project.id}`,
      "POST",
      { name: " Launch ", dueDate: "2028-02-29", description: "Goal" },
    );
    expect(response.status).toBe(200);
    const created = await response.json();
    expect(created).toMatchObject({
      name: "Launch",
      dueDate: "2028-02-29",
      status: "open",
      closedAt: null,
    });
    const close = await request(`/api/milestone/${created.id}`, "PATCH", {
      status: "closed",
      name: "Launch ready",
    });
    expect(close.status).toBe(200);
    const closed = await close.json();
    expect(closed.closedAt).toBeTruthy();
    const repeat = await request(`/api/milestone/${created.id}`, "PATCH", {
      status: "closed",
    });
    expect((await repeat.json()).closedAt).toBe(closed.closedAt);
    const reopen = await request(`/api/milestone/${created.id}`, "PATCH", {
      status: "open",
      dueDate: null,
    });
    expect(await reopen.json()).toMatchObject({
      closedAt: null,
      dueDate: null,
    });
  });
  it("rejects invalid dates, empty names, empty patches and invalid pagination", async () => {
    const { request, project, milestone } = await fixture();
    for (const body of [
      { name: " " },
      { name: "Bad", dueDate: "2026-02-29" },
      { name: "Bad", dueDate: "2026-10-31T00:00:00Z" },
    ])
      expect(
        (await request(`/api/milestone/project/${project.id}`, "POST", body))
          .status,
      ).toBe(400);
    expect(
      (await request(`/api/milestone/${milestone.id}`, "PATCH", {})).status,
    ).toBe(400);
    expect(
      (await request(`/api/milestone/project/${project.id}?page=NaN`)).status,
    ).toBe(400);
  });
  it("allows members to link tasks but denies milestone administration", async () => {
    const { request, project, milestone, seedTask } = await fixture("member");
    const task = await seedTask("to-do", null);
    expect((await request(`/api/milestone/project/${project.id}`)).status).toBe(
      200,
    );
    expect(
      (
        await request(`/api/milestone/project/${project.id}`, "POST", {
          name: "Denied",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(`/api/milestone/${milestone.id}`, "PATCH", {
          status: "closed",
        })
      ).status,
    ).toBe(403);
    expect(
      (await request(`/api/milestone/${milestone.id}`, "DELETE")).status,
    ).toBe(403);
    const link = await request(`/api/task/${task.id}/milestone`, "PATCH", {
      milestoneId: milestone.id,
    });
    expect(link.status).toBe(200);
    expect((await link.json()).milestoneId).toBe(milestone.id);
    expect(
      (
        await request(`/api/task/${task.id}/milestone`, "PATCH", {
          milestoneId: null,
        })
      ).status,
    ).toBe(200);
  });
  it("enforces viewer and edited custom-role permissions", async () => {
    const { request, project, milestone, seedTask, member } =
      await fixture("viewer");
    const task = await seedTask("to-do", null);
    expect((await request(`/api/milestone/project/${project.id}`)).status).toBe(
      200,
    );
    expect(
      (
        await request(`/api/task/${task.id}/milestone`, "PATCH", {
          milestoneId: milestone.id,
        })
      ).status,
    ).toBe(403);
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: member.workspace.id,
      role: "viewer",
      permission: JSON.stringify({
        project: ["read", "update"],
        task: ["read"],
      }),
    });
    expect(
      (
        await request(`/api/milestone/${milestone.id}`, "PATCH", {
          name: "Editable",
        })
      ).status,
    ).toBe(200);
    expect(
      (await request(`/api/milestone/${milestone.id}`, "DELETE")).status,
    ).toBe(403);
    expect(
      (
        await request(`/api/milestone/project/${project.id}`, "POST", {
          name: "Denied",
        })
      ).status,
    ).toBe(403);
  });
  it("restricts API key scopes even for an instance admin", async () => {
    const { member, project, milestone } = await fixture();
    await db
      .update(schema.userTable)
      .set({ role: "admin" })
      .where(eq(schema.userTable.id, member.user.id));
    const token = "milestone-test-key";
    const [key] = await db
      .insert(schema.apikeyTable)
      .values({
        referenceId: member.user.id,
        userId: member.user.id,
        key: createHash("sha256").update(token).digest("base64url"),
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: JSON.stringify({ project: ["read"], task: ["read"] }),
      })
      .returning();
    const { app } = createApp();
    const read = await app.request(`/api/milestone/project/${project.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(read.status).toBe(200);
    const update = () =>
      app.request(`/api/milestone/${milestone.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "Restricted" }),
      });
    expect((await update()).status).toBe(403);
    await db
      .update(schema.apikeyTable)
      .set({
        permissions: JSON.stringify({
          project: ["read", "update"],
          task: ["read"],
        }),
      })
      .where(eq(schema.apikeyTable.id, key.id));
    expect((await update()).status).toBe(200);
    expect(
      (
        await app.request(`/api/milestone/${milestone.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        })
      ).status,
    ).toBe(403);
  });
  it("requires task and project read scopes for task boards, details and milestone activities", async () => {
    const { member, project, seedTask } = await fixture();
    const task = await seedTask();
    const token = "milestone-no-task-read";
    await db.insert(schema.apikeyTable).values({
      referenceId: member.user.id,
      userId: member.user.id,
      key: createHash("sha256").update(token).digest("base64url"),
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      permissions: JSON.stringify({ project: ["read"] }),
    });
    const { app } = createApp();
    for (const path of [
      `/api/task/tasks/${project.id}`,
      `/api/task/${task.id}`,
      `/api/activity/${task.id}`,
    ]) {
      expect(
        (
          await app.request(path, {
            headers: { Authorization: `Bearer ${token}` },
          })
        ).status,
      ).toBe(403);
    }
  });
  it.each(["owner", "admin"])(
    "allows the workspace %s to create milestones",
    async (role) => {
      const { request, project } = await fixture(role);
      expect(
        (
          await request(`/api/milestone/project/${project.id}`, "POST", {
            name: "Allowed",
          })
        ).status,
      ).toBe(200);
    },
  );
  it("denies creation for a custom role even with project:update", async () => {
    const { request, project, member } = await fixture("delivery-manager");
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: member.workspace.id,
      role: "delivery-manager",
      permission: JSON.stringify({
        project: ["read", "update"],
        task: ["read", "update"],
      }),
    });
    expect(
      (
        await request(`/api/milestone/project/${project.id}`, "POST", {
          name: "Denied",
        })
      ).status,
    ).toBe(403);
  });
  it("does not let an instance admin with a member workspace role bypass the creation restriction", async () => {
    const { request, project, member } = await fixture("member");
    await db
      .update(schema.userTable)
      .set({ role: "admin" })
      .where(eq(schema.userTable.id, member.user.id));
    expect(
      (
        await request(`/api/milestone/project/${project.id}`, "POST", {
          name: "Denied",
        })
      ).status,
    ).toBe(403);
  });
  it("denies cross-workspace reads and mutations", async () => {
    const { request, milestone } = await fixture();
    const other = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(other.user);
    expect((await request(`/api/milestone/${milestone.id}`)).status).toBe(403);
    expect(
      (
        await request(`/api/milestone/${milestone.id}`, "PATCH", {
          name: "Stolen",
        })
      ).status,
    ).toBe(403);
  });
  it("rejects another project's milestone even in the same workspace", async () => {
    const { request, member, milestone } = await fixture();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({ projectId: project.id, title: "Elsewhere" })
      .returning();
    expect(
      (
        await request(`/api/task/${task.id}/milestone`, "PATCH", {
          milestoneId: milestone.id,
        })
      ).status,
    ).toBe(400);
    await expect(
      db
        .update(schema.taskTable)
        .set({ milestoneId: milestone.id })
        .where(eq(schema.taskTable.id, task.id)),
    ).rejects.toThrow();
  });
  it("computes progress independently of task pagination and custom final column names", async () => {
    const { request, milestone, project, columns, seedTask } = await fixture();
    await db
      .update(schema.columnTable)
      .set({ slug: "shipped" })
      .where(eq(schema.columnTable.id, columns.done.id));
    await seedTask("shipped");
    await seedTask("to-do");
    await seedTask("planned");
    await seedTask("archived");
    const data = await (await request(`/api/milestone/${milestone.id}`)).json();
    expect(data).toMatchObject({
      totalTasks: 3,
      completedTasks: 1,
      archivedTasks: 1,
      progressPercent: 33,
      status: "open",
    });
    const page = await (
      await request(`/api/milestone/${milestone.id}/tasks?limit=1`)
    ).json();
    expect(page.data).toHaveLength(1);
    expect(page.pagination.total).toBe(3);
    const archived = await (
      await request(`/api/milestone/${milestone.id}/tasks?archived=true`)
    ).json();
    expect(archived.data).toHaveLength(1);
    await db
      .update(schema.columnTable)
      .set({ isFinal: true })
      .where(eq(schema.columnTable.id, columns.todo.id));
    const changed = await (
      await request(`/api/milestone/project/${project.id}`)
    ).json();
    expect(changed.data[0]).toMatchObject({
      completedTasks: 2,
      progressPercent: 67,
    });
  });
  it("returns zero progress for no tasks and never automatically closes", async () => {
    const { request, milestone, seedTask } = await fixture();
    expect(
      await (await request(`/api/milestone/${milestone.id}`)).json(),
    ).toMatchObject({ totalTasks: 0, progressPercent: 0 });
    await seedTask("done");
    expect(
      await (await request(`/api/milestone/${milestone.id}`)).json(),
    ).toMatchObject({ progressPercent: 100, status: "open" });
  });
  it("creates tasks with a milestone and rejects new membership in closed milestones", async () => {
    const { request, project, milestone, seedTask } = await fixture();
    const body = {
      title: "New",
      description: "",
      priority: "low",
      status: "to-do",
      milestoneId: milestone.id,
    };
    const created = await request(`/api/task/${project.id}`, "POST", body);
    expect(created.status).toBe(200);
    expect((await created.json()).milestoneId).toBe(milestone.id);
    const linked = await seedTask();
    const unlinked = await seedTask("to-do", null);
    await request(`/api/milestone/${milestone.id}`, "PATCH", {
      status: "closed",
    });
    expect(
      (await request(`/api/task/${project.id}`, "POST", body)).status,
    ).toBe(409);
    expect(
      (
        await request(`/api/task/${unlinked.id}/milestone`, "PATCH", {
          milestoneId: milestone.id,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(`/api/task/${linked.id}/milestone`, "PATCH", {
          milestoneId: milestone.id,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(`/api/task/${linked.id}/milestone`, "PATCH", {
          milestoneId: null,
        })
      ).status,
    ).toBe(200);
  });
  it("updates bulk membership atomically and rejects missing task IDs", async () => {
    const { request, milestone, seedTask } = await fixture();
    const first = await seedTask("to-do", null);
    const second = await seedTask("planned", null);
    const body = {
      taskIds: [first.id, "missing"],
      operation: "updateMilestone",
      value: milestone.id,
    };
    expect((await request("/api/task/bulk", "PATCH", body)).status).toBe(404);
    expect(
      (
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, first.id),
        })
      )?.milestoneId,
    ).toBeNull();
    expect(
      (
        await request("/api/task/bulk", "PATCH", {
          ...body,
          taskIds: [first.id, second.id],
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request("/api/task/bulk", "PATCH", {
          ...body,
          taskIds: [first.id, second.id],
          value: null,
        })
      ).status,
    ).toBe(200);
  });
  it("preserves task data while detaching a deleted milestone", async () => {
    const { request, milestone, seedTask } = await fixture();
    const task = await seedTask();
    const removed = await request(`/api/milestone/${milestone.id}`, "DELETE");
    expect(await removed.json()).toMatchObject({
      success: true,
      detachedTasks: 1,
    });
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, task.id),
      }),
    ).toMatchObject({ title: task.title, milestoneId: null });
  });
  it("clears membership on project move and cascades project deletion", async () => {
    const { request, member, project, milestone, seedTask } = await fixture();
    const task = await seedTask();
    const { project: destination } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const response = await request(`/api/task/move/${task.id}`, "PUT", {
      destinationProjectId: destination.id,
    });
    expect(response.status).toBe(200);
    expect((await response.json()).task).toMatchObject({
      projectId: destination.id,
      milestoneId: null,
    });
    await seedTask();
    await db
      .delete(schema.projectTable)
      .where(eq(schema.projectTable.id, project.id));
    expect(
      await db.query.milestoneTable.findFirst({
        where: eq(schema.milestoneTable.id, milestone.id),
      }),
    ).toBeUndefined();
  });
  it("filters authenticated boards and excludes milestone metadata from public boards", async () => {
    const { request, project, milestone, seedTask } = await fixture();
    await seedTask();
    await seedTask("to-do", null);
    const board = await (
      await request(`/api/task/tasks/${project.id}?milestoneId=${milestone.id}`)
    ).json();
    expect(board.data.columns[0].tasks).toHaveLength(1);
    expect(board.data.columns[0].tasks[0].milestoneId).toBe(milestone.id);
    expect(
      (
        await request(
          `/api/task/tasks/${project.id}?milestoneId=${milestone.id}&withoutMilestone=true`,
        )
      ).status,
    ).toBe(400);
    await db
      .update(schema.projectTable)
      .set({ isPublic: true })
      .where(eq(schema.projectTable.id, project.id));
    const publicBoard = await (
      await request(`/api/public-project/${project.id}`)
    ).json();
    expect(publicBoard.columns[0].tasks).toHaveLength(2);
    for (const task of publicBoard.columns[0].tasks)
      expect(task).not.toHaveProperty("milestoneId");
    expect(JSON.stringify(publicBoard)).not.toContain(milestone.id);
  });
  it("serializes assignment with closing and deleting", async () => {
    const { milestone, member, seedTask } = await fixture();
    const task = await seedTask("to-do", null);
    await Promise.allSettled([
      setTaskMilestones([task.id], milestone.id, member.user.id),
      updateMilestone(milestone.id, { status: "closed" }),
    ]);
    const closed = await db.query.milestoneTable.findFirst({
      where: eq(schema.milestoneTable.id, milestone.id),
    });
    expect(closed?.status).toBe("closed");
    await expect(
      setTaskMilestones(
        [(await seedTask("to-do", null)).id],
        milestone.id,
        member.user.id,
      ),
    ).rejects.toThrow("Reopen");
    await updateMilestone(milestone.id, { status: "open" });
    await Promise.allSettled([
      setTaskMilestones([task.id], milestone.id, member.user.id),
      deleteMilestone(milestone.id, member.user.id),
    ]);
    expect(
      await db.query.milestoneTable.findFirst({
        where: eq(schema.milestoneTable.id, milestone.id),
      }),
    ).toBeUndefined();
    expect(
      await db.query.taskTable.findFirst({
        where: and(
          eq(schema.taskTable.id, task.id),
          eq(schema.taskTable.projectId, milestone.projectId),
        ),
      }),
    ).toMatchObject({ milestoneId: null });
  });
});
