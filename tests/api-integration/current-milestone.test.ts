import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
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
  const [first, second] = await db
    .insert(schema.milestoneTable)
    .values([
      { projectId: project.id, name: "First" },
      { projectId: project.id, name: "Second" },
    ])
    .returning();
  mockAuthenticatedSession(member.user);
  const { app } = createApp();
  const request = (path: string, method = "GET", body?: unknown) =>
    app.request(path, {
      method,
      headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const select = (id: string, isCurrent = true) =>
    request(`/api/milestone/${id}`, "PATCH", { isCurrent });
  const current = () => request(`/api/milestone/project/${project.id}/current`);
  const task = (milestoneId?: string | null) =>
    request(`/api/task/${project.id}`, "POST", {
      title: "New task",
      description: "",
      status: "to-do",
      priority: "no-priority",
      milestoneId,
    });
  return {
    member,
    project,
    first: first!,
    second: second!,
    request,
    select,
    current,
    task,
  };
}

describe("API integration: current milestone", () => {
  beforeEach(resetTestDatabase);

  it("switches and clears the project default without changing existing tasks", async () => {
    const { first, second, select, current, task } = await fixture();
    expect(await (await current()).json()).toBeNull();
    expect((await select(first.id)).status).toBe(200);
    const created = await (await task()).json();
    expect(created.milestoneId).toBe(first.id);
    expect((await select(second.id)).status).toBe(200);
    expect(await (await current()).json()).toMatchObject({
      id: second.id,
      isCurrent: true,
    });
    const [previous] = await db
      .select()
      .from(schema.milestoneTable)
      .where(eq(schema.milestoneTable.id, first.id));
    expect(previous.isCurrent).toBe(false);
    const [existingTask] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, created.id));
    expect(existingTask.milestoneId).toBe(first.id);
    await select(second.id, false);
    expect(await (await current()).json()).toBeNull();
    expect((await (await task()).json()).milestoneId).toBeNull();
  });

  it("respects explicit task assignments and null instead of the default", async () => {
    const { first, second, select, task } = await fixture();
    await select(first.id);
    for (const [input, expected] of [
      [undefined, first.id],
      [null, null],
      [second.id, second.id],
    ] as const) {
      const response = await task(input);
      expect(response.status).toBe(200);
      expect((await response.json()).milestoneId).toBe(expected);
    }
    const outsider = await createWorkspaceMember();
    const { project: foreign } = await createProjectFixture({
      workspaceId: outsider.workspace.id,
    });
    const [foreignMilestone] = await db
      .insert(schema.milestoneTable)
      .values({ projectId: foreign.id, name: "Foreign", isCurrent: true })
      .returning();
    expect((await task(foreignMilestone.id)).status).toBe(400);
  });

  it("clears the current designation on close or delete and does not restore it on reopen", async () => {
    const { first, select, current, request, task } = await fixture();
    await select(first.id);
    const close = await request(`/api/milestone/${first.id}`, "PATCH", {
      status: "closed",
    });
    expect(await close.json()).toMatchObject({
      isCurrent: false,
      status: "closed",
    });
    expect(await (await current()).json()).toBeNull();
    expect((await select(first.id)).status).toBe(409);
    expect((await task(first.id)).status).toBe(409);
    const reopened = await request(`/api/milestone/${first.id}`, "PATCH", {
      status: "open",
    });
    expect((await reopened.json()).isCurrent).toBe(false);
    await select(first.id);
    const invalid = await request(`/api/milestone/${first.id}`, "PATCH", {
      isCurrent: true,
      status: "closed",
    });
    expect(invalid.status).toBe(409);
    expect((await (await current()).json()).id).toBe(first.id);
    expect((await request(`/api/milestone/${first.id}`, "DELETE")).status).toBe(
      200,
    );
    expect(await (await current()).json()).toBeNull();
    expect((await (await task()).json()).milestoneId).toBeNull();
  });

  it("can create a current milestone and keeps defaults separate per project", async () => {
    const { project, member, first, select, request, current } =
      await fixture();
    await select(first.id);
    const { project: other } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const otherResponse = await request(
      `/api/milestone/project/${other.id}`,
      "POST",
      { name: "Other", isCurrent: true },
    );
    expect(otherResponse.status).toBe(200);
    const response = await request(
      `/api/milestone/project/${project.id}`,
      "POST",
      { name: "New default", isCurrent: true },
    );
    expect(response.status).toBe(200);
    expect(await (await current()).json()).toMatchObject({
      name: "New default",
      isCurrent: true,
    });
    expect(
      await (
        await request(`/api/milestone/project/${other.id}/current`)
      ).json(),
    ).toMatchObject({ name: "Other", isCurrent: true });
  });

  it("enforces workspace permissions and rejects reads and switches from another workspace", async () => {
    const { first, current, select, request } = await fixture("member");
    expect((await current()).status).toBe(200);
    expect((await select(first.id)).status).toBe(403);
    const outsider = await createWorkspaceMember();
    const { project: foreign } = await createProjectFixture({
      workspaceId: outsider.workspace.id,
    });
    const [foreignMilestone] = await db
      .insert(schema.milestoneTable)
      .values({ projectId: foreign.id, name: "Private", isCurrent: true })
      .returning();
    expect([403, 404]).toContain(
      (await request(`/api/milestone/project/${foreign.id}/current`)).status,
    );
    expect([403, 404]).toContain((await select(foreignMilestone.id)).status);
  });

  it("serializes concurrent switches and task creation and enforces database constraints", async () => {
    const { first, second, select, project, current, task } = await fixture();
    const responses = await Promise.all([
      select(first.id),
      select(second.id),
      task(),
    ]);
    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 200,
    ]);
    const designated = await db
      .select()
      .from(schema.milestoneTable)
      .where(
        and(
          eq(schema.milestoneTable.projectId, project.id),
          eq(schema.milestoneTable.isCurrent, true),
        ),
      );
    expect(designated).toHaveLength(1);
    const currentId = (await (await current()).json()).id;
    expect((await (await task()).json()).milestoneId).toBe(currentId);
    await expect(
      db
        .update(schema.milestoneTable)
        .set({ isCurrent: true })
        .where(
          eq(
            schema.milestoneTable.id,
            currentId === first.id ? second.id : first.id,
          ),
        ),
    ).rejects.toThrow();
    await expect(
      db
        .update(schema.milestoneTable)
        .set({ status: "closed", closedAt: new Date() })
        .where(eq(schema.milestoneTable.id, currentId)),
    ).rejects.toThrow();
  });
});
