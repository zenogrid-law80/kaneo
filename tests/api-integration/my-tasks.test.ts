import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

describe("my workspace tasks", () => {
  beforeEach(resetTestDatabase);
  it("scopes tasks to the caller and workspace and excludes final and archived work", async () => {
    const member = await createWorkspaceMember();
    const outsider = await createWorkspaceMember();
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const { project: otherProject } = await createProjectFixture({
      workspaceId: outsider.workspace.id,
    });
    const { project: archived } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    await db
      .update(schema.projectTable)
      .set({ archivedAt: new Date() })
      .where(eq(schema.projectTable.id, archived.id));
    await db
      .update(schema.columnTable)
      .set({ isFinal: true })
      .where(eq(schema.columnTable.id, columns.inReview.id));
    await db.insert(schema.taskTable).values([
      {
        id: "mine",
        number: 1,
        projectId: project.id,
        userId: member.user.id,
        title: "Mine",
        status: "planned",
      },
      {
        id: "other-user",
        number: 2,
        projectId: project.id,
        userId: outsider.user.id,
        title: "Other",
      },
      {
        id: "other-workspace",
        number: 3,
        projectId: otherProject.id,
        userId: member.user.id,
        title: "Other workspace",
      },
      {
        id: "finished",
        number: 4,
        projectId: project.id,
        userId: member.user.id,
        title: "Final",
        status: "in-review",
      },
      {
        id: "archived-task",
        number: 5,
        projectId: project.id,
        userId: member.user.id,
        title: "Archived",
        status: "archived",
      },
      {
        id: "archived-project",
        number: 6,
        projectId: archived.id,
        userId: member.user.id,
        title: "Archived project",
      },
    ]);
    mockAuthenticatedSession(member.user);
    const app = createApp().app;
    const response = await app.request(
      `/api/workspace/${member.workspace.id}/my-tasks`,
    );
    expect(response.status).toBe(200);
    expect(
      (await response.json()).items.map((task: { id: string }) => task.id),
    ).toEqual(["mine"]);
    expect(
      (await app.request(`/api/workspace/${outsider.workspace.id}/my-tasks`))
        .status,
    ).toBe(403);
    expect(
      (
        await app.request(
          `/api/workspace/${member.workspace.id}/my-tasks?page=0`,
        )
      ).status,
    ).toBe(400);
  });
  it("rejects anonymous callers and members without task read permission", async () => {
    const member = await createWorkspaceMember({ role: "restricted" });
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: member.workspace.id,
      role: "restricted",
      permission: JSON.stringify({ project: ["read"] }),
    });
    const app = createApp().app;
    mockAnonymousSession();
    expect(
      (await app.request(`/api/workspace/${member.workspace.id}/my-tasks`))
        .status,
    ).toBe(401);
    mockAuthenticatedSession(member.user);
    expect(
      (await app.request(`/api/workspace/${member.workspace.id}/my-tasks`))
        .status,
    ).toBe(403);
  });
  it("paginates deterministically with undated tasks last", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    await db.insert(schema.taskTable).values(
      Array.from({ length: 13 }, (_, i) => ({
        id: `task-${String(i).padStart(2, "0")}`,
        number: i + 1,
        projectId: project.id,
        userId: member.user.id,
        title: `Task ${i}`,
        dueDate: i === 12 ? null : new Date("2026-09-01T00:00:00Z"),
      })),
    );
    mockAuthenticatedSession(member.user);
    const app = createApp().app;
    const first = await (
      await app.request(`/api/workspace/${member.workspace.id}/my-tasks`)
    ).json();
    const second = await (
      await app.request(`/api/workspace/${member.workspace.id}/my-tasks?page=2`)
    ).json();
    expect(first.items).toHaveLength(12);
    expect(first.hasMore).toBe(true);
    expect(second.items.map((task: { id: string }) => task.id)).toEqual([
      "task-12",
    ]);
    expect(second.hasMore).toBe(false);
  });
  it("filters before pagination using inclusive local start and exclusive end", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    await db.insert(schema.taskTable).values([
      ...Array.from({ length: 13 }, (_, i) => ({
        id: `overdue-${i}`,
        projectId: project.id,
        userId: member.user.id,
        number: i + 1,
        title: "Overdue",
        dueDate: new Date("2026-09-04T14:59:59Z"),
      })),
      {
        id: "start",
        projectId: project.id,
        userId: member.user.id,
        number: 14,
        title: "Today",
        dueDate: new Date("2026-09-04T15:00:00Z"),
      },
      {
        id: "end",
        projectId: project.id,
        userId: member.user.id,
        number: 15,
        title: "Tomorrow",
        dueDate: new Date("2026-09-05T15:00:00Z"),
      },
      {
        id: "undated",
        projectId: project.id,
        userId: member.user.id,
        number: 16,
        title: "No date",
      },
    ]);
    mockAuthenticatedSession(member.user);
    const app = createApp().app;
    const base = `/api/workspace/${member.workspace.id}/my-tasks`;
    const query = new URLSearchParams({
      due: "today",
      dayStart: "2026-09-05T00:00:00+09:00",
      dayEnd: "2026-09-06T00:00:00+09:00",
    });
    const today = await (await app.request(`${base}?${query}`)).json();
    expect(today.items.map((task: { id: string }) => task.id)).toEqual([
      "start",
    ]);
    expect(today.hasMore).toBe(false);
    query.set("due", "overdue");
    const overdue = await (await app.request(`${base}?${query}`)).json();
    expect(overdue.items).toHaveLength(12);
    expect(overdue.hasMore).toBe(true);
    const undated = await (await app.request(`${base}?due=undated`)).json();
    expect(undated.items.map((task: { id: string }) => task.id)).toEqual([
      "undated",
    ]);
    expect((await app.request(`${base}?due=today`)).status).toBe(400);
    expect((await app.request(`${base}?due=invalid`)).status).toBe(400);
    query.set("dayEnd", query.get("dayStart") ?? "");
    expect((await app.request(`${base}?${query}`)).status).toBe(400);
  });
});
