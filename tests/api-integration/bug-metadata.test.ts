import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

async function fixture() {
  const member = await createWorkspaceMember({ role: "admin" });
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  mockAuthenticatedSession(member.user);
  const { app } = createApp();
  const request = (path = "", method = "GET", body?: unknown) =>
    app.request(`/api/bug/project/${project.id}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  return { member, project, request, app };
}

describe("API integration: bug metadata, search and sorting", () => {
  beforeEach(resetTestDatabase);

  it("defaults existing-style creation to unassigned metadata, records edits, and supports clearing", async () => {
    const { request } = await fixture();
    const created = await request("", "POST", { title: "Metadata" });
    expect(created.status).toBe(200);
    const bug = await created.json();
    expect(bug).toMatchObject({
      priority: "no-priority",
      severity: "no-severity",
      environment: null,
    });
    const patch = {
      priority: "urgent",
      severity: "critical",
      environment: "production",
    };
    expect(
      await (await request(`/${bug.id}`, "PATCH", patch)).json(),
    ).toMatchObject(patch);
    const history = await (await request(`/${bug.id}/history`)).json();
    expect(history.data[0].changes).toEqual(
      expect.arrayContaining([
        { field: "priority", before: "no-priority", after: "urgent" },
        { field: "severity", before: "no-severity", after: "critical" },
        { field: "environment", before: null, after: "production" },
      ]),
    );
    await request(`/${bug.id}`, "PATCH", patch);
    expect(
      (await (await request(`/${bug.id}/history`)).json()).pagination.total,
    ).toBe(2);
    const cleared = {
      priority: "no-priority",
      severity: "no-severity",
      environment: null,
    };
    expect(
      await (await request(`/${bug.id}`, "PATCH", cleared)).json(),
    ).toMatchObject(cleared);
    expect(
      await (await request("", "POST", { title: "Selected", ...patch })).json(),
    ).toMatchObject(patch);
  });

  it("combines metadata, people, milestone and body search before pagination and excludes other projects", async () => {
    const { request, project, member } = await fixture();
    const { project: other } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const [milestone] = await db
      .insert(schema.milestoneTable)
      .values({ projectId: project.id, name: "Release" })
      .returning();
    await db.insert(schema.bugTable).values([
      {
        projectId: project.id,
        title: "First",
        description: "**Crash** 재현",
        priority: "urgent",
        severity: "critical",
        environment: "production",
        fixerId: member.user.id,
        milestoneId: milestone.id,
      },
      {
        projectId: project.id,
        title: "Second",
        description: "CRASH 재현",
        priority: "high",
        severity: "major",
        environment: null,
        fixerId: member.user.id,
        milestoneId: milestone.id,
      },
      {
        projectId: project.id,
        title: "Wrong environment",
        description: "crash",
        priority: "urgent",
        severity: "critical",
        environment: "development",
        fixerId: member.user.id,
        milestoneId: milestone.id,
      },
      {
        projectId: other.id,
        title: "Private",
        description: "crash",
        priority: "urgent",
        severity: "critical",
        environment: "production",
        fixerId: member.user.id,
      },
    ]);
    const filters = `?search=crash&priority=urgent,high&severity=critical,major&environment=production,none&fixerId=${member.user.id}&milestoneId=${milestone.id}&sortBy=title&sortOrder=asc&limit=1`;
    const page = await (await request(filters + "&page=2")).json();
    expect(page.pagination).toMatchObject({ total: 2, totalPages: 2, page: 2 });
    expect(page.data.map((bug: { title: string }) => bug.title)).toEqual([
      "Second",
    ]);
    expect(page.data[0]).not.toHaveProperty("description");
    expect(
      (await (await request(filters + "&page=1")).json()).data[0].title,
    ).toBe("First");
    expect(
      (await (await request("?search=Private")).json()).pagination.total,
    ).toBe(0);
  });

  it("searches title and Markdown description as literal case-insensitive substrings", async () => {
    const { request, project } = await fixture();
    await db.insert(schema.bugTable).values([
      {
        projectId: project.id,
        title: "MixedCase 제목",
        description: "평범한 내용",
      },
      {
        projectId: project.id,
        title: "본문에서 검색",
        description: "## 한글 재현 100% C:\\temp_file",
      },
      {
        projectId: project.id,
        title: "Unrelated",
        description: "100X temp-file",
      },
    ]);
    for (const [term, title] of [
      ["mixedcase", "MixedCase 제목"],
      ["한글 재현", "본문에서 검색"],
      ["%", "본문에서 검색"],
      ["_", "본문에서 검색"],
      ["\\", "본문에서 검색"],
    ]) {
      const result = await (
        await request(`?search=${encodeURIComponent(term)}`)
      ).json();
      expect(result.data.map((bug: { title: string }) => bug.title)).toEqual([
        title,
      ]);
    }
  });

  it("sorts by impact and environment rank in both directions with unassigned values last and stable ties", async () => {
    const { request, project } = await fixture();
    const createdAt = new Date("2026-10-01T00:00:00Z");
    await db.insert(schema.bugTable).values([
      {
        id: "rank-high-b",
        projectId: project.id,
        title: "B",
        priority: "urgent",
        severity: "critical",
        environment: "production",
        createdAt,
      },
      {
        id: "rank-high-a",
        projectId: project.id,
        title: "A",
        priority: "urgent",
        severity: "critical",
        environment: "production",
        createdAt,
      },
      {
        id: "rank-low",
        projectId: project.id,
        title: "Low",
        priority: "low",
        severity: "trivial",
        environment: "development",
        createdAt,
      },
      { id: "rank-none", projectId: project.id, title: "None", createdAt },
    ]);
    for (const sortBy of ["priority", "severity", "environment"]) {
      for (const [sortOrder, ids] of [
        ["desc", ["rank-high-b", "rank-high-a", "rank-low", "rank-none"]],
        ["asc", ["rank-low", "rank-high-b", "rank-high-a", "rank-none"]],
      ] as const) {
        const result = await (
          await request(`?sortBy=${sortBy}&sortOrder=${sortOrder}`)
        ).json();
        expect(result.data.map((bug: { id: string }) => bug.id)).toEqual(ids);
        const page = await (
          await request(
            `?sortBy=${sortBy}&sortOrder=${sortOrder}&limit=1&page=2`,
          )
        ).json();
        expect(page.data[0].id).toBe(ids[1]);
      }
    }
  });

  it("rejects unsupported values, unbounded searches and cross-workspace requests", async () => {
    const { request, project, app } = await fixture();
    for (const body of [
      { priority: "invalid" },
      { severity: "invalid" },
      { environment: "qa" },
    ]) {
      expect(
        (await request("", "POST", { title: "Invalid", ...body })).status,
      ).toBe(400);
    }
    for (const query of [
      "priority=urgent,invalid",
      "severity=high",
      "environment=qa",
      "sortBy=description",
      "sortOrder=random",
      `search=${"x".repeat(201)}`,
    ]) {
      expect((await request(`?${query}`)).status).toBe(400);
    }
    const outsider = await createWorkspaceMember();
    mockAuthenticatedSession(outsider.user);
    const response = await app.request(
      `/api/bug/project/${project.id}?search=secret&environment=production&sortBy=priority`,
    );
    expect([403, 404]).toContain(response.status);
  });
});
