import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import type { WorkspaceActivity } from "@/fetchers/activity/get-workspace-activities";
import { ActivityFeedItem } from "./activity-feed-item";
vi.mock("react-i18next", async (original) => ({
  ...(await original<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    search,
    children,
  }: {
    to: string;
    params: object;
    search?: object;
    children: ReactNode;
  }) => (
    <a
      href={to}
      data-params={JSON.stringify(params)}
      data-search={JSON.stringify(search)}
    >
      {children}
    </a>
  ),
}));
afterEach(cleanup);
const common = {
  id: "event",
  createdAt: "2026-10-30T10:00:00.000Z",
  eventData: null,
  excerpt: "Updated evidence",
  userId: "author",
  userName: "Mira",
  userImage: null,
  externalUserName: null,
  externalUserAvatar: null,
  projectId: "project",
  projectSlug: "QA",
};
it("shows the edited Bug comment preview and links directly to Bug details", () => {
  const activity: WorkspaceActivity = {
    ...common,
    resourceType: "bug",
    bugId: "bug",
    bugTitle: "Login error",
    type: "bug_comment_updated",
  };
  render(<ActivityFeedItem activity={activity} workspaceId="workspace" />);
  expect(screen.getByText("Updated evidence")).toBeVisible();
  expect(
    screen.getByText("workspace:home.activity.bugCommentUpdated"),
  ).toBeVisible();
  const link = screen.getByRole("link", { name: /Login error/ });
  expect(link).toHaveAttribute(
    "href",
    "/dashboard/workspace/$workspaceId/project/$projectId/bugs",
  );
  expect(JSON.parse(link.getAttribute("data-params")!)).toEqual({
    workspaceId: "workspace",
    projectId: "project",
  });
  expect(JSON.parse(link.getAttribute("data-search")!)).toEqual({
    bugId: "bug",
  });
});
it("keeps existing Task comments linked to their Task details", () => {
  render(
    <ActivityFeedItem
      activity={{
        ...common,
        resourceType: "task",
        type: "comment",
        taskId: "task",
        taskTitle: "Existing task",
        taskNumber: 7,
      }}
      workspaceId="workspace"
    />,
  );
  expect(screen.getByText("Updated evidence")).toBeVisible();
  const link = screen.getByRole("link", { name: "QA-7 Existing task" });
  expect(link).toHaveAttribute(
    "href",
    "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
  );
  expect(JSON.parse(link.getAttribute("data-params")!)).toEqual({
    workspaceId: "workspace",
    projectId: "project",
    taskId: "task",
  });
});
