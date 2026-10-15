import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import moveProject from "../../apps/api/src/project/controllers/move-project";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

// Complete event subscribers before the next test truncates their tables.
vi.mock("../../apps/api/src/events", async (importOriginal) => {
  const events =
    await importOriginal<typeof import("../../apps/api/src/events")>();
  return {
    ...events,
    publishEvent: (type: string, data: unknown) =>
      events.publishEvent(type, data, { waitForHandlers: true }),
  };
});
vi.mock("../../apps/api/src/notification-preferences/delivery", () => ({
  deliverNotification: async () => {},
}));

async function fixture(role = "admin") {
  const owner = await createWorkspaceMember({ role, userName: "Owner" });
  const helper = await createWorkspaceMember({ userName: "Helper" });
  const other = await createWorkspaceMember({ userName: "Other" });
  await db.insert(schema.workspaceUserTable).values({
    workspaceId: owner.workspace.id,
    userId: helper.user.id,
    role: "member",
    joinedAt: new Date(),
  });
  const { project, columns } = await createProjectFixture({
    workspaceId: owner.workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Task",
      userId: owner.user.id,
      status: columns.todo.slug,
      columnId: columns.todo.id,
      createdAt: new Date("2026-06-10T12:00:00Z"),
      dueDate: new Date("2020-01-01T00:00:00Z"),
    })
    .returning();
  mockAuthenticatedSession(owner.user);
  const { app } = createApp();
  const request = (path: string, method = "GET", body?: object) =>
    app.request(path, {
      method,
      ...(body
        ? {
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    });
  const url = `/api/task/supporting-assignees/${task.id}`;
  return { owner, helper, other, project, columns, task, request, url };
}

describe("task supporting assignees", () => {
  beforeEach(resetTestDatabase);

  it("includes workspace-scoped supporting names on private task pages and omits them publicly", async () => {
    const { owner, helper, other, task, project, request, url } =
      await fixture();
    await request(`${url}/${helper.user.id}`, "PUT");
    const [primaryMembership] = await db
      .select()
      .from(schema.workspaceUserTable)
      .where(
        and(
          eq(schema.workspaceUserTable.workspaceId, owner.workspace.id),
          eq(schema.workspaceUserTable.userId, owner.user.id),
        ),
      );
    const [foreignMembership] = await db
      .select()
      .from(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.workspaceId, other.workspace.id));
    await db.insert(schema.taskSupportingAssigneeTable).values([
      { taskId: task.id, membershipId: primaryMembership.id },
      { taskId: task.id, membershipId: foreignMembership.id },
    ]);
    const tasks = [task];
    for (const status of ["planned", "archived"]) {
      const [next] = await db
        .insert(schema.taskTable)
        .values({
          title: status,
          projectId: project.id,
          status,
          number: tasks.length + 1,
        })
        .returning();
      tasks.push(next);
      await request(
        `/api/task/supporting-assignees/${next.id}/${helper.user.id}`,
        "PUT",
      );
    }
    const refresh = await request(`/api/task/${task.id}?view=board`);
    expect(refresh.status).toBe(200);
    expect((await refresh.json()).supportingAssignees).toEqual([
      { userId: helper.user.id, name: "Helper" },
    ]);
    const response = await request(`/api/task/tasks/${project.id}`);
    expect(response.status).toBe(200);
    const { data } = await response.json();
    const all = [
      ...data.columns.flatMap((column: { tasks: unknown[] }) => column.tasks),
      ...data.plannedTasks,
      ...data.archivedTasks,
    ];
    expect(all).toHaveLength(3);
    for (const row of all)
      expect(row.supportingAssignees).toEqual([
        { userId: helper.user.id, name: "Helper" },
      ]);
    await db
      .update(schema.projectTable)
      .set({ isPublic: true })
      .where(eq(schema.projectTable.id, project.id));
    mockAnonymousSession();
    const publicResponse = await request(`/api/public-project/${project.id}`);
    expect(publicResponse.status).toBe(200);
    const publicData = await publicResponse.json();
    for (const row of [
      ...publicData.columns.flatMap(
        (column: { tasks: unknown[] }) => column.tasks,
      ),
      ...publicData.plannedTasks,
      ...publicData.archivedTasks,
    ])
      expect(row).not.toHaveProperty("supportingAssignees");
  });

  it("keeps assignment order across detail and board reads, preserves idempotent assigns, and appends reassigned people", async () => {
    const { owner, helper, other, task, project, request, url } =
      await fixture();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: owner.workspace.id,
      userId: other.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    await db
      .update(schema.userTable)
      .set({ name: "Zulu" })
      .where(eq(schema.userTable.id, helper.user.id));
    await db
      .update(schema.userTable)
      .set({ name: "Alpha" })
      .where(eq(schema.userTable.id, other.user.id));
    await request(`${url}/${helper.user.id}`, "PUT");
    const [membership] = await db
      .select()
      .from(schema.workspaceUserTable)
      .where(
        and(
          eq(schema.workspaceUserTable.workspaceId, owner.workspace.id),
          eq(schema.workspaceUserTable.userId, helper.user.id),
        ),
      );
    const originalTime = new Date("2000-01-01T00:00:00Z");
    await db
      .update(schema.taskSupportingAssigneeTable)
      .set({ createdAt: originalTime })
      .where(
        and(
          eq(schema.taskSupportingAssigneeTable.taskId, task.id),
          eq(schema.taskSupportingAssigneeTable.membershipId, membership.id),
        ),
      );
    await request(`${url}/${other.user.id}`, "PUT");
    await request(`${url}/${helper.user.id}`, "PUT");
    const assigned = await (await request(url)).json();
    expect(assigned.map((person: { name: string }) => person.name)).toEqual([
      "Zulu",
      "Alpha",
    ]);
    const [stored] = await db
      .select()
      .from(schema.taskSupportingAssigneeTable)
      .where(
        and(
          eq(schema.taskSupportingAssigneeTable.taskId, task.id),
          eq(schema.taskSupportingAssigneeTable.membershipId, membership.id),
        ),
      );
    expect(stored.createdAt).toEqual(originalTime);
    const details = await (
      await request(`/api/task/${task.id}?view=board`)
    ).json();
    expect(
      details.supportingAssignees.map(
        (person: { name: string }) => person.name,
      ),
    ).toEqual(["Zulu", "Alpha"]);
    const board = await (await request(`/api/task/tasks/${project.id}`)).json();
    const row = board.data.columns
      .flatMap((column: { tasks: Array<{ id: string }> }) => column.tasks)
      .find((item: { id: string }) => item.id === task.id);
    expect(
      row.supportingAssignees.map((person: { name: string }) => person.name),
    ).toEqual(["Zulu", "Alpha"]);
    await request(`${url}/${helper.user.id}`, "DELETE");
    await request(`${url}/${helper.user.id}`, "PUT");
    expect(
      (await (await request(url)).json()).map(
        (person: { name: string }) => person.name,
      ),
    ).toEqual(["Alpha", "Zulu"]);
  });

  it("atomically clears all supporting members once without changing primary or another task", async () => {
    const { owner, helper, other, task, request, url } = await fixture();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: owner.workspace.id,
      userId: other.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    const [another] = await db
      .insert(schema.taskTable)
      .values({
        projectId: task.projectId,
        title: "Another task",
        number: 2,
      })
      .returning();
    const anotherUrl = `/api/task/supporting-assignees/${another.id}`;
    for (const user of [helper.user, other.user])
      expect((await request(`${url}/${user.id}`, "PUT")).status).toBe(204);
    expect(
      (await request(`${anotherUrl}/${helper.user.id}`, "PUT")).status,
    ).toBe(204);
    const responses = await Promise.all([
      request(url, "DELETE"),
      request(url, "DELETE"),
    ]);
    expect(responses.map((response) => response.status)).toEqual([204, 204]);
    expect(await (await request(url)).json()).toEqual([]);
    expect(await (await request(anotherUrl)).json()).toHaveLength(1);
    const [stored] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, task.id));
    expect(stored.userId).toBe(owner.user.id);
    const history = await db
      .select()
      .from(schema.activityTable)
      .where(
        and(
          eq(schema.activityTable.taskId, task.id),
          eq(schema.activityTable.type, "supporting_assignee_removed"),
        ),
      );
    expect(history).toHaveLength(2);
    for (const user of [helper.user, other.user])
      expect(history).toContainEqual(
        expect.objectContaining({
          userId: owner.user.id,
          eventData: {
            supportingAssigneeId: user.id,
            supportingAssigneeName: user.name,
          },
        }),
      );
    expect(await db.select().from(schema.notificationTable)).toHaveLength(0);
  });

  it("authorizes clear-all and leaves assignments intact for forbidden callers", async () => {
    const { owner, helper, other, request, url } = await fixture();
    await request(`${url}/${helper.user.id}`, "PUT");
    await db
      .update(schema.workspaceUserTable)
      .set({ role: "viewer" })
      .where(
        and(
          eq(schema.workspaceUserTable.workspaceId, owner.workspace.id),
          eq(schema.workspaceUserTable.userId, owner.user.id),
        ),
      );
    expect((await request(url, "DELETE")).status).toBe(403);
    mockAuthenticatedSession(other.user);
    expect((await request(url, "DELETE")).status).toBe(403);
    mockAnonymousSession();
    expect((await request(url, "DELETE")).status).toBe(401);
    expect(
      await db.select().from(schema.taskSupportingAssigneeTable),
    ).toHaveLength(1);
    expect(await db.select().from(schema.activityTable)).toHaveLength(1);
  });

  it("records the actor and target for add/remove exactly once and returns them in task and workspace activity", async () => {
    const { owner, helper, task, request, url } = await fixture();
    for (const method of ["PUT", "PUT", "DELETE", "DELETE"]) {
      expect((await request(`${url}/${helper.user.id}`, method)).status).toBe(
        204,
      );
    }
    const response = await request(`/api/activity/${task.id}`);
    expect(response.status).toBe(200);
    const activities = await response.json();
    expect(activities).toHaveLength(2);
    for (const type of [
      "supporting_assignee_added",
      "supporting_assignee_removed",
    ]) {
      expect(activities).toContainEqual(
        expect.objectContaining({
          taskId: task.id,
          userId: owner.user.id,
          type,
          content: null,
          eventData: {
            supportingAssigneeId: helper.user.id,
            supportingAssigneeName: "Helper",
          },
        }),
      );
    }
    const workspaceResponse = await request(
      `/api/activity/workspace/${owner.workspace.id}`,
    );
    expect(workspaceResponse.status).toBe(200);
    expect(await workspaceResponse.json()).toHaveLength(2);
  });

  it("records self assignment using the logged-in actor", async () => {
    const { owner, task, request, url } = await fixture();
    await db
      .update(schema.taskTable)
      .set({ userId: null })
      .where(eq(schema.taskTable.id, task.id));
    expect((await request(`${url}/${owner.user.id}`, "PUT")).status).toBe(204);
    expect(await db.select().from(schema.activityTable)).toEqual([
      expect.objectContaining({
        taskId: task.id,
        userId: owner.user.id,
        type: "supporting_assignee_added",
        eventData: {
          supportingAssigneeId: owner.user.id,
          supportingAssigneeName: "Owner",
        },
      }),
    ]);
  });

  it("rejects the primary assignee and hides legacy duplicate assignments while allowing their removal", async () => {
    const { owner, task, request, url } = await fixture();
    expect((await request(`${url}/${owner.user.id}`, "PUT")).status).toBe(400);
    expect(await db.select().from(schema.activityTable)).toHaveLength(0);
    const [membership] = await db
      .select()
      .from(schema.workspaceUserTable)
      .where(
        and(
          eq(schema.workspaceUserTable.workspaceId, owner.workspace.id),
          eq(schema.workspaceUserTable.userId, owner.user.id),
        ),
      );
    await db
      .insert(schema.taskSupportingAssigneeTable)
      .values({ taskId: task.id, membershipId: membership.id });
    expect(await (await request(url)).json()).toEqual([]);
    expect((await request(`${url}/${owner.user.id}`, "DELETE")).status).toBe(
      204,
    );
    expect(await db.select().from(schema.taskSupportingAssigneeTable)).toEqual(
      [],
    );
  });

  it.each(["assignee", "full", "bulk"])(
    "removes supporting designation when promoted through %s updates",
    async (method) => {
      const { helper, task, request, url } = await fixture();
      expect((await request(`${url}/${helper.user.id}`, "PUT")).status).toBe(
        204,
      );
      const response =
        method === "assignee"
          ? await request(`/api/task/assignee/${task.id}`, "PUT", {
              userId: helper.user.id,
            })
          : method === "bulk"
            ? await request("/api/task/bulk", "PATCH", {
                taskIds: [task.id],
                operation: "updateAssignee",
                value: helper.user.id,
              })
            : await request(`/api/task/${task.id}`, "PUT", {
                title: task.title,
                status: task.status,
                priority: task.priority,
                projectId: task.projectId,
                position: task.position,
                userId: helper.user.id,
              });
      expect(response.status).toBe(200);
      expect(await (await request(url)).json()).toEqual([]);
      expect(
        await db.select().from(schema.taskSupportingAssigneeTable),
      ).toEqual([]);
      expect((await request(`${url}/${helper.user.id}`, "PUT")).status).toBe(
        400,
      );
    },
  );

  it("serializes concurrent primary and supporting assignments", async () => {
    const { helper, task, request, url } = await fixture();
    const [primary, supporting] = await Promise.all([
      request(`/api/task/assignee/${task.id}`, "PUT", {
        userId: helper.user.id,
      }),
      request(`${url}/${helper.user.id}`, "PUT"),
    ]);
    expect(primary.status).toBe(200);
    expect([204, 400]).toContain(supporting.status);
    expect(await db.select().from(schema.taskSupportingAssigneeTable)).toEqual(
      [],
    );
  });

  it("adds multiple members concurrently, is idempotent, and removes without changing the primary assignee or sending notifications", async () => {
    const { owner, helper, other, task, request, url } = await fixture();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: owner.workspace.id,
      userId: other.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    expect(await (await request(url)).json()).toEqual([]);
    const results = await Promise.all(
      [other.user.id, helper.user.id, helper.user.id].map((id) =>
        request(`${url}/${id}`, "PUT"),
      ),
    );
    expect(results.map((r) => r.status)).toEqual([204, 204, 204]);
    expect(await db.select().from(schema.activityTable)).toHaveLength(2);
    const assigned = await (await request(url)).json();
    expect(assigned).toHaveLength(2);
    expect(assigned).toContainEqual({
      userId: helper.user.id,
      name: helper.user.name,
      image: null,
    });
    const [stored] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, task.id));
    expect(stored.userId).toBe(owner.user.id);
    expect(await db.select().from(schema.notificationTable)).toHaveLength(0);
    expect((await request(`${url}/${helper.user.id}`, "DELETE")).status).toBe(
      204,
    );
    expect((await request(`${url}/${helper.user.id}`, "DELETE")).status).toBe(
      204,
    );
    expect(await (await request(url)).json()).toHaveLength(1);
  });

  it("requires assignment permission and authentication, and rejects foreign members", async () => {
    const { owner, helper, other, request, url } = await fixture("viewer");
    expect((await request(url)).status).toBe(200);
    for (const method of ["PUT", "DELETE"])
      expect((await request(`${url}/${helper.user.id}`, method)).status).toBe(
        403,
      );
    mockAuthenticatedSession(other.user);
    expect((await request(url)).status).toBe(403);
    expect((await request(`${url}/${other.user.id}`, "PUT")).status).toBe(403);
    mockAuthenticatedSession(owner.user);
    await db
      .update(schema.workspaceUserTable)
      .set({ role: "admin" })
      .where(
        and(
          eq(schema.workspaceUserTable.userId, owner.user.id),
          eq(schema.workspaceUserTable.workspaceId, owner.workspace.id),
        ),
      );
    expect((await request(`${url}/${other.user.id}`, "PUT")).status).toBe(400);
    mockAnonymousSession();
    expect((await request(url)).status).toBe(401);
    expect(await db.select().from(schema.activityTable)).toHaveLength(0);
  });

  it("cleans assignments when a membership or task is deleted", async () => {
    const { owner, helper, task, request, url } = await fixture();
    await request(`${url}/${helper.user.id}`, "PUT");
    await db
      .delete(schema.workspaceUserTable)
      .where(
        and(
          eq(schema.workspaceUserTable.workspaceId, owner.workspace.id),
          eq(schema.workspaceUserTable.userId, helper.user.id),
        ),
      );
    expect(await (await request(url)).json()).toEqual([]);
    expect(
      await db.select().from(schema.taskSupportingAssigneeTable),
    ).toHaveLength(0);
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: owner.workspace.id,
      userId: helper.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    expect((await request(`${url}/${helper.user.id}`, "PUT")).status).toBe(204);
    await db.delete(schema.taskTable).where(eq(schema.taskTable.id, task.id));
    expect(
      await db.select().from(schema.taskSupportingAssigneeTable),
    ).toHaveLength(0);
  });

  it("clears source-workspace supporting assignments when moving a project", async () => {
    const { owner, helper, other, project, request, url } = await fixture();
    await request(`${url}/${helper.user.id}`, "PUT");
    await moveProject(
      project.id,
      owner.workspace.id,
      other.workspace.id,
      owner.user.id,
    );
    expect(
      await db.select().from(schema.taskSupportingAssigneeTable),
    ).toHaveLength(0);
    mockAuthenticatedSession(other.user);
    expect(await (await request(url)).json()).toEqual([]);
  });

  it("includes supporting participation only when requested, deduplicates owners, and applies date and milestone filters", async () => {
    const { owner, helper, project, columns, task, request, url } =
      await fixture();
    const [milestone] = await db
      .insert(schema.milestoneTable)
      .values({ projectId: project.id, name: "Release" })
      .returning();
    const [done] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Done",
        number: 2,
        userId: owner.user.id,
        milestoneId: milestone.id,
        status: columns.done.slug,
        columnId: columns.done.id,
        createdAt: new Date("2026-06-15T12:00:00Z"),
      })
      .returning();
    await db.insert(schema.activityTable).values({
      taskId: done.id,
      userId: owner.user.id,
      type: "status_changed",
      content: "Completed",
      createdAt: new Date("2026-06-20T12:00:00Z"),
      eventData: {
        oldStatus: columns.todo.slug,
        newStatus: columns.done.slug,
      },
    });
    for (const taskId of [task.id, done.id]) {
      for (const userId of [helper.user.id])
        expect(
          (
            await request(
              `/api/task/supporting-assignees/${taskId}/${userId}`,
              "PUT",
            )
          ).status,
        ).toBe(204);
    }
    const base = `/api/workspace/${owner.workspace.id}`;
    const [team] = await db
      .insert(schema.teamTable)
      .values({
        id: randomUUID(),
        workspaceId: owner.workspace.id,
        name: "Team",
        createdAt: new Date(),
      })
      .returning();
    await db.insert(schema.teamMemberTable).values(
      [owner.user.id, helper.user.id].map((userId) => ({
        id: randomUUID(),
        teamId: team.id,
        userId,
        createdAt: new Date(),
      })),
    );
    const filter = `projectId=${project.id}&startDate=2026-06-01&endDate=2026-06-30`;
    for (const include of [false, true]) {
      const query = `${filter}&includeSupportingAssignees=${include}`;
      const summaryResponse = await request(
        `${base}/member-statistics?${query}`,
      );
      expect(summaryResponse.status).toBe(200);
      const summary = await summaryResponse.json();
      expect(
        summary.find((row: { userId: string }) => row.userId === owner.user.id),
      ).toMatchObject({ assignedTasks: 2, completedTasks: 1, overdueTasks: 1 });
      const supporter = summary.find(
        (row: { userId: string }) => row.userId === helper.user.id,
      );
      expect(supporter).toMatchObject({
        assignedTasks: include ? 2 : 0,
        completedTasks: include ? 1 : 0,
        overdueTasks: include ? 1 : 0,
      });
      expect(supporter.overdueTaskItems).toHaveLength(include ? 1 : 0);
      const monthlyResponse = await request(
        `${base}/member-team-monthly-statistics?${query}`,
      );
      expect(monthlyResponse.status).toBe(200);
      const monthly = await monthlyResponse.json();
      expect(monthly.teams[0].months).toEqual([
        {
          month: "2026-06",
          createdTasks: include ? 4 : 2,
          completedTasks: include ? 2 : 1,
        },
      ]);
      expect(monthly.teams[0].overdueTasks).toBe(include ? 2 : 1);
      expect(
        monthly.members.find(
          (row: { userId: string }) => row.userId === helper.user.id,
        ).months,
      ).toEqual([
        {
          month: "2026-06",
          createdTasks: include ? 2 : 0,
          completedTasks: include ? 1 : 0,
        },
      ]);
      expect(
        monthly.members.find(
          (row: { userId: string }) => row.userId === owner.user.id,
        ).months,
      ).toEqual([{ month: "2026-06", createdTasks: 2, completedTasks: 1 }]);
    }
    const scoped = await (
      await request(
        `${base}/member-statistics?${filter}&includeSupportingAssignees=true&milestoneId=${milestone.id}`,
      )
    ).json();
    expect(
      scoped.find((row: { userId: string }) => row.userId === helper.user.id),
    ).toMatchObject({ assignedTasks: 1, completedTasks: 1, overdueTasks: 0 });
    expect(
      (
        await request(
          `${base}/member-statistics?includeSupportingAssignees=invalid`,
        )
      ).status,
    ).toBe(400);
    await request(`${url}/${helper.user.id}`, "DELETE");
    const removed = await (
      await request(
        `${base}/member-statistics?${filter}&includeSupportingAssignees=true`,
      )
    ).json();
    expect(
      removed.find((row: { userId: string }) => row.userId === helper.user.id),
    ).toMatchObject({ assignedTasks: 1, overdueTasks: 0 });
    const [unassigned] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Supporting only",
        number: 3,
        status: columns.todo.slug,
        columnId: columns.todo.id,
        createdAt: new Date("2026-06-25T12:00:00Z"),
      })
      .returning();
    expect(
      (
        await request(
          `/api/task/supporting-assignees/${unassigned.id}/${helper.user.id}`,
          "PUT",
        )
      ).status,
    ).toBe(204);
    const supportingOnly = await (
      await request(
        `${base}/member-statistics?${filter}&includeSupportingAssignees=true`,
      )
    ).json();
    expect(
      supportingOnly.find(
        (row: { userId: string }) => row.userId === helper.user.id,
      ),
    ).toMatchObject({ assignedTasks: 2 });
  });
});
