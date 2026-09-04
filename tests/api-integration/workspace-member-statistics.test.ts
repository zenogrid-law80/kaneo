import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

describe("API integration: workspace member statistics", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("aggregates assigned tasks for every member and excludes archived projects", async () => {
    const member = await createWorkspaceMember({
      userName: "Alice",
      role: "admin",
    });
    const secondUserId = `user-${randomUUID()}`;
    await db.insert(schema.userTable).values({
      id: secondUserId,
      email: `${secondUserId}@example.com`,
      emailVerified: true,
      name: "Bob",
    });
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: member.workspace.id,
      userId: secondUserId,
      role: "member",
      joinedAt: new Date(),
    });

    const active = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    await db.insert(schema.taskTable).values([
      {
        projectId: active.project.id,
        userId: member.user.id,
        number: 1,
        title: "Active task",
        status: active.columns.inProgress.slug,
        columnId: active.columns.inProgress.id,
        dueDate: new Date("2020-01-01T00:00:00.000Z"),
      },
      {
        projectId: active.project.id,
        userId: member.user.id,
        number: 2,
        title: "Completed task",
        status: active.columns.done.slug,
        columnId: active.columns.done.id,
      },
      {
        projectId: active.project.id,
        userId: member.user.id,
        number: 3,
        title: "Archived task",
        status: "archived",
      },
    ]);

    const archived = await createProjectFixture({
      workspaceId: member.workspace.id,
      name: "Archived project",
    });
    await db
      .update(schema.projectTable)
      .set({ archivedAt: new Date() })
      .where(eq(schema.projectTable.id, archived.project.id));
    await db.insert(schema.taskTable).values({
      projectId: archived.project.id,
      userId: member.user.id,
      number: 1,
      title: "Excluded task",
      status: archived.columns.done.slug,
      columnId: archived.columns.done.id,
    });

    mockAuthenticatedSession(member.user);
    const response = await createApp().app.request(
      `/api/workspace/${member.workspace.id}/member-statistics`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        userId: member.user.id,
        name: "Alice",
        email: member.user.email,
        image: null,
        assignedTasks: 3,
        completedTasks: 2,
        overdueTasks: 1,
        overdueTaskItems: [
          {
            id: expect.any(String),
            title: "Active task",
            projectId: active.project.id,
          },
        ],
        inProgressTasks: 1,
        completionRate: 67,
      },
      {
        userId: secondUserId,
        name: "Bob",
        email: `${secondUserId}@example.com`,
        image: null,
        assignedTasks: 0,
        completedTasks: 0,
        overdueTasks: 0,
        overdueTaskItems: [],
        inProgressTasks: 0,
        completionRate: 0,
      },
    ]);

    const otherActive = await createProjectFixture({
      workspaceId: member.workspace.id,
      name: "Other active project",
    });
    await db.insert(schema.taskTable).values({
      projectId: otherActive.project.id,
      userId: member.user.id,
      number: 1,
      title: "Other active task",
      status: otherActive.columns.inProgress.slug,
      columnId: otherActive.columns.inProgress.id,
    });
    const filteredResponse = await createApp().app.request(
      `/api/workspace/${member.workspace.id}/member-statistics?projectId=${active.project.id}`,
    );
    const filteredPayload = (await filteredResponse.json()) as Array<{
      userId: string;
      assignedTasks: number;
    }>;
    expect(
      filteredPayload.find((row) => row.userId === member.user.id),
    ).toMatchObject({ assignedTasks: 3 });
  });

  it("returns 12 months of created and completed task counts per project", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const project = await createProjectFixture({
      workspaceId: member.workspace.id,
      name: "Roadmap",
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.project.id,
        userId: member.user.id,
        number: 1,
        title: "Shipped task",
        status: project.columns.done.slug,
        columnId: project.columns.done.id,
      })
      .returning();
    await db.insert(schema.activityTable).values({
      taskId: task.id,
      userId: member.user.id,
      type: "status_changed",
      eventData: { oldStatus: "in-progress", newStatus: "done" },
    });
    const [overdueTask] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.project.id,
        userId: member.user.id,
        number: 2,
        title: "Late roadmap task",
        status: project.columns.inProgress.slug,
        columnId: project.columns.inProgress.id,
        dueDate: new Date("2020-01-01T00:00:00.000Z"),
      })
      .returning();
    await createProjectFixture({
      workspaceId: member.workspace.id,
      name: "Other project",
    });

    mockAuthenticatedSession(member.user);
    const response = await createApp().app.request(
      `/api/workspace/${member.workspace.id}/project-monthly-statistics?projectId=${project.project.id}`,
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as Array<{
      projectId: string;
      projectName: string;
      overdueTasks: number;
      overdueTaskItems: Array<{
        id: string;
        title: string;
        projectId: string;
      }>;
      months: Array<{
        month: string;
        createdTasks: number;
        completedTasks: number;
      }>;
    }>;
    expect(payload).toHaveLength(1);
    expect(payload[0]).toMatchObject({
      projectId: project.project.id,
      projectName: "Roadmap",
      overdueTasks: 1,
      overdueTaskItems: [
        {
          id: overdueTask.id,
          title: "Late roadmap task",
          projectId: project.project.id,
        },
      ],
    });
    expect(payload[0]?.months).toHaveLength(12);
    expect(payload[0]?.months.at(-1)).toMatchObject({
      createdTasks: 2,
      completedTasks: 1,
    });

    const filteredResponse = await createApp().app.request(
      `/api/workspace/${member.workspace.id}/project-monthly-statistics?projectId=${project.project.id}&startDate=2000-01-01&endDate=2000-01-31`,
    );
    expect(filteredResponse.status).toBe(200);
    const filteredPayload = (await filteredResponse.json()) as typeof payload;
    expect(filteredPayload[0]?.months).toEqual([
      { month: "2000-01", createdTasks: 0, completedTasks: 0 },
    ]);
  });

  it("returns monthly counts for members and their current teams", async () => {
    const member = await createWorkspaceMember({
      userName: "Alice",
      role: "admin",
    });
    const project = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const teamId = `team-${randomUUID()}`;
    await db.insert(schema.teamTable).values({
      id: teamId,
      name: "Engineering",
      workspaceId: member.workspace.id,
      createdAt: new Date(),
    });
    await db.insert(schema.teamMemberTable).values({
      id: `team-member-${randomUUID()}`,
      teamId,
      userId: member.user.id,
      createdAt: new Date(),
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.project.id,
        userId: member.user.id,
        number: 1,
        title: "Member task",
        status: project.columns.done.slug,
        columnId: project.columns.done.id,
      })
      .returning();
    await db.insert(schema.activityTable).values({
      taskId: task.id,
      userId: member.user.id,
      type: "status_changed",
      eventData: { oldStatus: "in-progress", newStatus: "done" },
    });
    const [overdueTask] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.project.id,
        userId: member.user.id,
        number: 2,
        title: "Late member task",
        status: project.columns.inProgress.slug,
        columnId: project.columns.inProgress.id,
        dueDate: new Date("2020-01-01T00:00:00.000Z"),
      })
      .returning();
    const otherProject = await createProjectFixture({
      workspaceId: member.workspace.id,
      name: "Other project",
    });
    await db.insert(schema.taskTable).values({
      projectId: otherProject.project.id,
      userId: member.user.id,
      number: 1,
      title: "Filtered out task",
      status: otherProject.columns.inProgress.slug,
      columnId: otherProject.columns.inProgress.id,
    });

    mockAuthenticatedSession(member.user);
    const response = await createApp().app.request(
      `/api/workspace/${member.workspace.id}/member-team-monthly-statistics?projectId=${project.project.id}`,
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      members: Array<{
        userId: string;
        overdueTaskItems: Array<{ id: string; title: string }>;
        months: Array<{ createdTasks: number; completedTasks: number }>;
      }>;
      teams: Array<{
        teamId: string;
        userIds: string[];
        overdueTaskItems: Array<{ id: string; title: string }>;
        months: Array<{ createdTasks: number; completedTasks: number }>;
      }>;
    };
    expect(payload.members).toHaveLength(1);
    expect(payload.members[0]?.userId).toBe(member.user.id);
    expect(payload.members[0]?.overdueTaskItems).toEqual([
      expect.objectContaining({
        id: overdueTask.id,
        title: "Late member task",
      }),
    ]);
    expect(payload.members[0]?.months.at(-1)).toMatchObject({
      createdTasks: 2,
      completedTasks: 1,
    });
    expect(payload.teams).toHaveLength(1);
    expect(payload.teams[0]?.teamId).toBe(teamId);
    expect(payload.teams[0]?.userIds).toEqual([member.user.id]);
    expect(payload.teams[0]?.overdueTaskItems).toEqual([
      expect.objectContaining({
        id: overdueTask.id,
        title: "Late member task",
      }),
    ]);
    expect(payload.teams[0]?.months.at(-1)).toMatchObject({
      createdTasks: 2,
      completedTasks: 1,
    });
  });

  it("rejects statistics requests from members without settings access", async () => {
    const member = await createWorkspaceMember({ role: "member" });
    mockAuthenticatedSession(member.user);

    const response = await createApp().app.request(
      `/api/workspace/${member.workspace.id}/member-statistics`,
    );

    expect(response.status).toBe(403);
  });
});
