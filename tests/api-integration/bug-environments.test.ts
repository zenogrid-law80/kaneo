import { beforeEach, describe, expect, it } from "vite-plus/test";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

describe("project bug environments", () => {
  beforeEach(resetTestDatabase);
  it("isolates options, preserves existing bug values when renamed or archived, and allows restoring", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const { project: other } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const request = (id: string, path = "", method = "GET", body?: unknown) =>
      app.request(`/api/bug/project/${id}${path}`, {
        method,
        headers: { "content-type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    expect(
      (await (await request(project.id, "/environments")).json()).map(
        (item: { id: string }) => item.id,
      ),
    ).toEqual(["development", "staging", "production"]);
    const created = await request(project.id, "/environments", "POST", {
      name: "QA 서버",
    });
    expect(created.status).toBe(200);
    const env = await created.json();
    expect(env).toMatchObject({ name: "QA 서버", archived: false });
    const bugResponse = await request(project.id, "", "POST", {
      title: "QA bug",
      environment: env.id,
    });
    expect(bugResponse.status).toBe(200);
    const bug = await bugResponse.json();
    expect(bug.environment).toBe(env.id);
    expect(
      (
        await request(project.id, `/${bug.id}`, "PATCH", {
          environment: "development",
        })
      ).status,
    ).toBe(200);
    const changes = (
      await (await request(project.id, `/${bug.id}/history`)).json()
    ).data[0].changes;
    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "environment",
          before: env.id,
          beforeLabel: "QA 서버",
          after: "development",
        }),
      ]),
    );
    expect(
      (
        await request(project.id, `/${bug.id}`, "PATCH", {
          environment: env.id,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(other.id, "", "POST", {
          title: "Invalid",
          environment: env.id,
        })
      ).status,
    ).toBe(400);
    expect((await request(other.id, `?environment=${env.id}`)).status).toBe(
      400,
    );
    expect(
      (await (await request(project.id, `?environment=${env.id}`)).json())
        .data[0].id,
    ).toBe(bug.id);
    expect(
      (
        await request(project.id, `/environments/${env.id}`, "PATCH", {
          name: "QA 2",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(project.id, `/environments/${env.id}`, "PATCH", {
          archived: true,
        })
      ).status,
    ).toBe(200);
    expect(
      (await (await request(project.id, "/environments")).json()).find(
        (x: { id: string }) => x.id === env.id,
      ),
    ).toMatchObject({ name: "QA 2", archived: true });
    expect(
      (await (await request(project.id, `/${bug.id}`)).json()).environment,
    ).toBe(env.id);
    expect(
      (
        await request(project.id, "", "POST", {
          title: "Not allowed",
          environment: env.id,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(project.id, `/${bug.id}`, "PATCH", {
          title: "Unchanged archived environment",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(project.id, `/${bug.id}`, "PATCH", {
          environment: env.id,
        })
      ).status,
    ).toBe(200);
    expect(
      (await (await request(project.id, `?environment=${env.id}`)).json())
        .data[0].id,
    ).toBe(bug.id);
    expect(
      (
        await request(project.id, `/environments/${env.id}`, "PATCH", {
          archived: false,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(project.id, "", "POST", {
          title: "Restored",
          environment: env.id,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(other.id, `/environments/${env.id}`, "PATCH", {
          name: "Leak",
        })
      ).status,
    ).toBe(404);
    const outsider = await createWorkspaceMember();
    mockAuthenticatedSession(outsider.user);
    expect([403, 404]).toContain(
      (await request(project.id, "/environments")).status,
    );
    expect([403, 404]).toContain(
      (
        await request(project.id, "/environments", "POST", {
          name: "No access",
        })
      ).status,
    );
  });

  it("sorts custom environments by name before pagination", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const request = (path: string, method = "GET", body?: unknown) =>
      app.request(`/api/bug/project/${project.id}${path}`, {
        method,
        headers: { "content-type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    const z = await (
      await request("/environments", "POST", { name: "Zulu" })
    ).json();
    const a = await (
      await request("/environments", "POST", { name: "Alpha" })
    ).json();
    await request("", "POST", { title: "Z bug", environment: z.id });
    await request("", "POST", { title: "A bug", environment: a.id });
    const result = await (
      await request("?sortBy=environment&sortOrder=asc&limit=1&page=1")
    ).json();
    expect(result.pagination.total).toBe(2);
    expect(result.data[0].title).toBe("A bug");
    const descending = await (
      await request("?sortBy=environment&sortOrder=desc&limit=1&page=1")
    ).json();
    expect(descending.data[0].title).toBe("Z bug");
  });

  it("allows modifying default options without overwriting existing bug identifiers", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const request = (path: string, method = "GET", body?: unknown) =>
      app.request(`/api/bug/project/${project.id}${path}`, {
        method,
        headers: { "content-type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    const bug = await (
      await request("", "POST", {
        title: "Existing",
        environment: "production",
      })
    ).json();
    expect(
      (
        await request("/environments/production", "PATCH", {
          name: "라이브",
          archived: true,
        })
      ).status,
    ).toBe(200);
    expect((await (await request(`/${bug.id}`)).json()).environment).toBe(
      "production",
    );
    expect(
      (await (await request("/environments")).json()).find(
        (x: { id: string }) => x.id === "production",
      ),
    ).toMatchObject({ name: "라이브", archived: true });
    expect(
      (await request("", "POST", { title: "No", environment: "production" }))
        .status,
    ).toBe(400);
  });
});
