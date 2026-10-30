import * as email from "@kaneo/email";
import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, expect, it, vi } from "vite-plus/test";
import {
  createBug,
  updateBug,
  deleteBug,
} from "../../apps/api/src/bug/controllers/bugs";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { deliverNotification } from "../../apps/api/src/notification-preferences/delivery";
import { persistNotification } from "../../apps/api/src/notification/controllers/create-notification";
import { mattermostPlugin } from "../../apps/api/src/plugins/mattermost";
import { postToMattermost } from "../../apps/api/src/plugins/mattermost/client";
import {
  registerPlugin,
  initializeEventSubscriptions,
} from "../../apps/api/src/plugins/registry";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createWorkspaceMember,
  createProjectFixture,
} from "./helpers/fixtures";

const delivery = vi.hoisted(() => ({ pending: [] as Promise<void>[] }));
vi.mock("@kaneo/email", async (original) => ({
  ...(await original<object>()),
  sendNotificationEmail: vi.fn(async () => undefined),
}));
vi.mock("../../apps/api/src/plugins/mattermost/client", () => ({
  postToMattermost: vi.fn(async () => undefined),
}));
vi.mock(
  "../../apps/api/src/notification-preferences/delivery",
  async (original) => {
    const actual =
      await original<
        typeof import("../../apps/api/src/notification-preferences/delivery")
      >();
    return {
      ...actual,
      deliverNotification: (id: string) => {
        const promise = actual.deliverNotification(id);
        delivery.pending.push(promise);
        return promise;
      },
    };
  },
);
vi.mock("../../apps/api/src/events", async (original) => {
  const events = await original<typeof import("../../apps/api/src/events")>();
  return {
    ...events,
    publishEvent: (...args: Parameters<typeof events.publishEvent>) =>
      events.publishEvent(args[0], args[1], { waitForHandlers: true }),
  };
});

async function settle() {
  while (delivery.pending.length) await Promise.all(delivery.pending.splice(0));
}
beforeAll(() => {
  registerPlugin(mattermostPlugin);
  initializeEventSubscriptions();
});
beforeEach(async () => {
  await settle();
  await resetTestDatabase();
  vi.clearAllMocks();
});

async function fixture() {
  const actor = await createWorkspaceMember({ role: "owner" });
  const fixer = await createWorkspaceMember({ userName: "Fixer" });
  const verifier = await createWorkspaceMember({ userName: "Verifier" });
  const { project } = await createProjectFixture({
    workspaceId: actor.workspace.id,
  });
  for (const member of [fixer, verifier]) {
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: actor.workspace.id,
      userId: member.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    await db.insert(schema.userNotificationPreferenceTable).values({
      userId: member.user.id,
      emailEnabled: true,
      taskAssignmentEnabled: true,
    });
    await db.insert(schema.userNotificationWorkspaceRuleTable).values({
      userId: member.user.id,
      workspaceId: actor.workspace.id,
      isActive: true,
      emailEnabled: true,
      projectMode: "all",
    });
  }
  const [integration] = await db
    .insert(schema.integrationTable)
    .values({
      projectId: project.id,
      type: "mattermost",
      isActive: true,
      config: JSON.stringify({
        webhookUrl: "https://mattermost.example/hooks/test-only",
      }),
    })
    .returning();
  const create = async (
    input: Partial<Parameters<typeof createBug>[1]> = {},
  ) => {
    const bug = await createBug(
      project.id,
      { title: "Notification bug", ...input },
      actor.user.id,
    );
    await settle();
    return bug;
  };
  const update = async (id: string, input: Parameters<typeof updateBug>[2]) => {
    const bug = await updateBug(project.id, id, input, actor.user.id);
    await settle();
    return bug;
  };
  return { actor, fixer, verifier, project, integration, create, update };
}

it("delivers creation to both designated people and one Mattermost channel with a Bug link", async () => {
  const { actor, fixer, verifier, project, create } = await fixture();
  const bug = await create({
    fixerId: fixer.user.id,
    verifierId: verifier.user.id,
  });
  expect(email.sendNotificationEmail).toHaveBeenCalledTimes(2);
  const url = `http://localhost:5173/dashboard/workspace/${actor.workspace.id}/project/${project.id}/bugs?bugId=${bug.id}`;
  for (const [person, role] of [
    [fixer, "fixer"],
    [verifier, "verifier"],
  ] as const) {
    expect(email.sendNotificationEmail).toHaveBeenCalledWith(
      person.user.email,
      "New bug created",
      expect.objectContaining({
        actionUrl: url,
        message: expect.stringContaining(role),
      }),
    );
  }
  expect(postToMattermost).toHaveBeenCalledTimes(1);
  expect(postToMattermost).toHaveBeenCalledWith(
    "https://mattermost.example/hooks/test-only",
    expect.objectContaining({
      attachments: [
        expect.objectContaining({
          title_link: url,
          fields: expect.arrayContaining([
            { title: "fixer", value: "Fixer", short: true },
            { title: "verifier", value: "Verifier", short: true },
          ]),
        }),
      ],
    }),
  );
  const rows = await db.select().from(schema.notificationTable);
  expect(rows).toHaveLength(2);
  expect(
    rows.every(
      (row) => row.resourceType === "bug" && row.type === "bug_created",
    ),
  ).toBe(true);
});

it("deduplicates a person holding both roles and only sends actual new assignments", async () => {
  const { fixer, verifier, create, update } = await fixture();
  const bug = await create({
    fixerId: fixer.user.id,
    verifierId: fixer.user.id,
  });
  expect(email.sendNotificationEmail).toHaveBeenCalledTimes(1);
  expect(vi.mocked(email.sendNotificationEmail).mock.calls[0][2]).toMatchObject(
    { message: expect.stringContaining("fixer, verifier") },
  );
  vi.clearAllMocks();
  await update(bug.id, {
    fixerId: fixer.user.id,
    verifierId: fixer.user.id,
    title: "Renamed",
    status: "resolved",
  });
  await update(bug.id, { fixerId: null, verifierId: null });
  expect(email.sendNotificationEmail).not.toHaveBeenCalled();
  expect(postToMattermost).not.toHaveBeenCalled();
  await update(bug.id, {
    fixerId: verifier.user.id,
    verifierId: verifier.user.id,
  });
  expect(email.sendNotificationEmail).toHaveBeenCalledTimes(1);
  expect(email.sendNotificationEmail).toHaveBeenCalledWith(
    verifier.user.email,
    "Bug assigned to you",
    expect.objectContaining({
      message: expect.stringContaining("fixer, verifier"),
    }),
  );
  expect(postToMattermost).toHaveBeenCalledTimes(1);
  await update(bug.id, { fixerId: fixer.user.id });
  expect(email.sendNotificationEmail).toHaveBeenCalledTimes(2);
  expect(vi.mocked(email.sendNotificationEmail).mock.calls[1][0]).toBe(
    fixer.user.email,
  );
});

it("posts unassigned creations to Mattermost and suppresses the creator's own creation email", async () => {
  const { actor, create } = await fixture();
  await create();
  await create({ fixerId: actor.user.id, verifierId: actor.user.id });
  expect(postToMattermost).toHaveBeenCalledTimes(2);
  expect(await db.select().from(schema.notificationTable)).toHaveLength(0);
});

it("serializes simultaneous assignments without sending the same assignment twice", async () => {
  const { fixer, create, update } = await fixture();
  const bug = await create();
  vi.clearAllMocks();
  await Promise.all([
    update(bug.id, { fixerId: fixer.user.id }),
    update(bug.id, { fixerId: fixer.user.id }),
  ]);
  expect(email.sendNotificationEmail).toHaveBeenCalledTimes(1);
  expect(postToMattermost).toHaveBeenCalledTimes(1);
});

it.each(["assignment", "email", "workspace", "project"] as const)(
  "respects the %s notification preference independently of Mattermost",
  async (kind) => {
    const { fixer, create } = await fixture();
    if (kind === "assignment" || kind === "email") {
      await db
        .update(schema.userNotificationPreferenceTable)
        .set(
          kind === "assignment"
            ? { taskAssignmentEnabled: false }
            : { emailEnabled: false },
        )
        .where(
          eq(schema.userNotificationPreferenceTable.userId, fixer.user.id),
        );
    } else {
      await db
        .update(schema.userNotificationWorkspaceRuleTable)
        .set(
          kind === "workspace"
            ? { isActive: false }
            : { projectMode: "selected" },
        )
        .where(
          eq(schema.userNotificationWorkspaceRuleTable.userId, fixer.user.id),
        );
    }
    await create({ fixerId: fixer.user.id });
    expect(email.sendNotificationEmail).not.toHaveBeenCalled();
    expect(postToMattermost).toHaveBeenCalledTimes(1);
    expect(await db.select().from(schema.notificationTable)).toHaveLength(
      kind === "assignment" ? 0 : 1,
    );
  },
);

it("respects Mattermost creation/assignment toggles and paused integrations", async () => {
  const { integration, fixer, create, update } = await fixture();
  await db
    .update(schema.integrationTable)
    .set({
      config: JSON.stringify({
        webhookUrl: "https://mattermost.example/hooks/test-only",
        events: { bugCreated: false, bugAssigneesChanged: false },
      }),
    })
    .where(eq(schema.integrationTable.id, integration.id));
  const bug = await create();
  await update(bug.id, { fixerId: fixer.user.id });
  expect(postToMattermost).not.toHaveBeenCalled();
  expect(email.sendNotificationEmail).toHaveBeenCalledTimes(1);
  await db
    .update(schema.integrationTable)
    .set({
      isActive: false,
      config: JSON.stringify({
        webhookUrl: "https://mattermost.example/hooks/test-only",
      }),
    })
    .where(eq(schema.integrationTable.id, integration.id));
  await create({ verifierId: fixer.user.id });
  expect(postToMattermost).not.toHaveBeenCalled();
  expect(email.sendNotificationEmail).toHaveBeenCalledTimes(2);
});

it("keeps Bug inbox rows workspace scoped and blocks delivery after membership loss or deletion", async () => {
  const { actor, fixer, project, create } = await fixture();
  const bug = await create({ fixerId: fixer.user.id });
  const [notification] = await db.select().from(schema.notificationTable);
  mockAuthenticatedSession(fixer.user);
  const { app } = createApp();
  expect(
    await (
      await app.request(`/api/notification?workspaceId=${actor.workspace.id}`)
    ).json(),
  ).toEqual([
    expect.objectContaining({
      resourceId: bug.id,
      eventData: expect.objectContaining({
        projectId: project.id,
        workspaceId: actor.workspace.id,
      }),
    }),
  ]);
  expect(
    await (
      await app.request(`/api/notification?workspaceId=${fixer.workspace.id}`)
    ).json(),
  ).toEqual([]);
  await db
    .update(schema.projectTable)
    .set({ isPublic: true })
    .where(eq(schema.projectTable.id, project.id));
  await db
    .delete(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.userId, fixer.user.id),
        eq(schema.workspaceUserTable.workspaceId, actor.workspace.id),
      ),
    );
  vi.clearAllMocks();
  await deliverNotification(notification.id);
  await settle();
  expect(email.sendNotificationEmail).not.toHaveBeenCalled();
  expect(await (await app.request("/api/notification")).json()).toEqual([]);
  expect(
    (
      await app.request(`/api/notification/${notification.id}/read`, {
        method: "PATCH",
      })
    ).status,
  ).toBe(404);
  expect(
    await persistNotification({
      userId: fixer.user.id,
      type: "bug_assigned",
      resourceType: "bug",
      resourceId: bug.id,
    }),
  ).toBeNull();
  await deleteBug(project.id, bug.id);
  await deliverNotification(notification.id);
  await settle();
  expect(email.sendNotificationEmail).not.toHaveBeenCalled();
});

it("keeps email working when Mattermost delivery fails and uses the recipient's Korean locale", async () => {
  const { fixer, create } = await fixture();
  await db
    .update(schema.userTable)
    .set({ locale: "ko-KR" })
    .where(eq(schema.userTable.id, fixer.user.id));
  vi.mocked(postToMattermost).mockRejectedValueOnce(
    new Error("Test delivery failure"),
  );
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const bug = await create({ verifierId: fixer.user.id });
  expect(bug.id).toBeTruthy();
  expect(email.sendNotificationEmail).toHaveBeenCalledWith(
    fixer.user.email,
    "새 버그가 등록되었습니다",
    expect.objectContaining({ message: expect.stringContaining("검수자") }),
  );
  expect(log).toHaveBeenCalled();
});
