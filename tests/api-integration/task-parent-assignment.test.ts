import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import {
  addConnection,
  initializeWebSocketAdapter,
  removeConnection,
  shutdownWebSocketAdapter,
} from "../../apps/api/src/ws";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(resetTestDatabase);

async function fixture(role = "member") {
  const member = await createWorkspaceMember({ role });
  const childProject = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const parentProject = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const [child, parent, grandchild] = await db
    .insert(schema.taskTable)
    .values([
      {
        projectId: childProject.project.id,
        title: "Existing child",
        number: 1,
        createdAt: new Date("2026-10-28"),
      },
      {
        projectId: parentProject.project.id,
        title: "Later parent",
        number: 2,
        createdAt: new Date("2026-10-29"),
      },
      { projectId: childProject.project.id, title: "Grandchild", number: 3 },
    ])
    .returning();
  mockAuthenticatedSession(member.user);
  return { ...member, child, parent, grandchild };
}

function assign(
  sourceTaskId: string,
  targetTaskId: string,
  relationType = "subtask",
) {
  return createApp().app.request("/api/task-relation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sourceTaskId, targetTaskId, relationType }),
  });
}

describe("assigning an existing parent", () => {
  it("links a later-created parent from another project and exposes it on the child", async () => {
    const { parent, child } = await fixture();
    const response = await assign(parent.id, child.id);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      sourceTaskId: parent.id,
      targetTaskId: child.id,
      relationType: "subtask",
    });
    const details = await createApp().app.request(
      `/api/task-relation/${child.id}`,
    );
    expect(details.status).toBe(200);
    expect(await details.json()).toMatchObject([
      {
        sourceTask: { id: parent.id, projectId: parent.projectId },
        targetTask: { id: child.id },
      },
    ]);
  });

  it("requires task update permission", async () => {
    const { parent, child } = await fixture("viewer");
    expect((await assign(parent.id, child.id)).status).toBe(403);
    expect(await db.query.taskRelationTable.findMany()).toHaveLength(0);
  });

  it("rejects self-parenting and a descendant as parent without changing existing links", async () => {
    const { parent, child, grandchild } = await fixture();
    expect((await assign(parent.id, child.id)).status).toBe(200);
    expect((await assign(child.id, grandchild.id)).status).toBe(200);
    expect((await assign(child.id, child.id)).status).toBe(400);
    const circular = await assign(grandchild.id, parent.id);
    expect(circular.status).toBe(400);
    expect(await circular.text()).toBe(
      "Cannot create a circular subtask hierarchy",
    );
    expect(await db.query.taskRelationTable.findMany()).toHaveLength(2);
    expect((await assign(grandchild.id, parent.id, "related")).status).toBe(
      200,
    );
  });

  it("serializes concurrent assignments that would jointly create a cycle", async () => {
    const { parent, child, grandchild } = await fixture();
    expect((await assign(parent.id, child.id)).status).toBe(200);
    const responses = await Promise.all([
      assign(child.id, grandchild.id),
      assign(grandchild.id, parent.id),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 400,
    ]);
    expect(await db.query.taskRelationTable.findMany()).toHaveLength(2);
  });

  it("terminates traversal when existing data contains a cycle", async () => {
    const { parent, child, grandchild } = await fixture();
    await db.insert(schema.taskRelationTable).values([
      {
        sourceTaskId: child.id,
        targetTaskId: grandchild.id,
        relationType: "subtask",
      },
      {
        sourceTaskId: grandchild.id,
        targetTaskId: child.id,
        relationType: "subtask",
      },
    ]);
    expect((await assign(parent.id, child.id)).status).toBe(200);
  });

  it("notifies observers in both projects when a parent is assigned and removed", async () => {
    const { parent, child, user, workspace } = await fixture();
    await initializeWebSocketAdapter();
    const parentSend = vi.fn();
    const childSend = vi.fn();
    const parentConnection = addConnection(
      parent.projectId,
      { send: parentSend } as never,
      user.id,
      "parent-observer",
      workspace.id,
    );
    const childConnection = addConnection(
      child.projectId,
      { send: childSend } as never,
      user.id,
      "child-observer",
      workspace.id,
    );
    try {
      const created = await assign(parent.id, child.id);
      expect(created.status).toBe(200);
      const relation = (await created.json()) as { id: string };
      const assertDelivery = async () => {
        for (const [send, projectId] of [
          [parentSend, parent.projectId],
          [childSend, child.projectId],
        ] as const) {
          await vi.waitFor(() => expect(send).toHaveBeenCalled());
          expect(
            send.mock.calls.map(([message]) => JSON.parse(message)),
          ).toContainEqual(
            expect.objectContaining({
              type: "TASK_RELATION_UPDATED",
              projectId,
              sourceTaskId: parent.id,
              targetTaskId: child.id,
            }),
          );
        }
      };
      await assertDelivery();
      parentSend.mockClear();
      childSend.mockClear();
      const removed = await createApp().app.request(
        `/api/task-relation/${relation.id}`,
        { method: "DELETE" },
      );
      expect(removed.status).toBe(200);
      await assertDelivery();
    } finally {
      removeConnection(parent.projectId, parentConnection);
      removeConnection(child.projectId, childConnection);
      await shutdownWebSocketAdapter();
    }
  });
});
