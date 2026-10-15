import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import HierarchyView from "./index";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock(
  "@/hooks/queries/workspace-users/use-get-active-workspace-users",
  () => ({
    useGetActiveWorkspaceUsers: () => ({
      data: {
        members: [{ userId: "owner", user: { name: "Owner", image: null } }],
      },
    }),
  }),
);
afterEach(cleanup);

it("shows only primary avatars and supporting counts on parent and child rows", async () => {
  const task: Task = {
    id: "parent",
    title: "Parent",
    projectId: "project",
    number: 1,
    description: null,
    status: "todo",
    priority: null,
    startDate: null,
    dueDate: null,
    position: 0,
    createdAt: "",
    userId: "owner",
    assigneeId: "owner",
    assigneeName: "Saved owner",
    supportingAssignees: [
      { userId: "owner", name: "Owner" },
      { userId: "a", name: "Alice" },
      { userId: "a", name: "Alice" },
      { userId: "c", name: "Charlie" },
    ],
  };
  const project: ProjectWithTasks = {
    id: "project",
    name: "Project",
    slug: "PROJ",
    icon: null,
    description: null,
    isPublic: false,
    workspaceId: "workspace",
    columns: [
      {
        id: "todo",
        slug: "todo",
        name: "Todo",
        icon: null,
        isFinal: false,
        tasks: [
          task,
          {
            ...task,
            id: "child",
            title: "Child",
            userId: null,
            assigneeId: null,
            assigneeName: null,
            supportingAssignees: [{ userId: "b", name: "Bob" }],
          },
        ],
      },
    ],
    plannedTasks: [],
    archivedTasks: [],
    subtaskRelations: [
      { id: "relation", sourceTaskId: "parent", targetTaskId: "child" },
    ],
  };
  const onOpenTask = vi.fn();
  render(<HierarchyView project={project} onOpenTask={onOpenTask} />);
  expect(
    screen.getByRole("group", {
      name: "tasks:supportingAssignees.label: Alice, Charlie",
    }),
  ).toBeVisible();
  expect(
    screen.getByRole("group", { name: "tasks:supportingAssignees.label: Bob" }),
  ).toBeVisible();
  const primary = screen.getByRole("img", {
    name: "tasks:supportingAssignees.primaryAssignee: Owner",
  });
  const supporting = screen.getByRole("group", {
    name: "tasks:supportingAssignees.label: Alice, Charlie",
  });
  expect(supporting).toHaveTextContent("+2");
  expect(
    screen.queryByRole("img", {
      name: "tasks:supportingAssignees.label: Alice",
    }),
  ).toBeNull();
  expect(primary).toBeVisible();
  expect(primary).toHaveAttribute(
    "title",
    "tasks:supportingAssignees.primaryAssignee: Owner",
  );
  expect(
    primary.compareDocumentPosition(supporting) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    screen.getByRole("img", { name: "tasks:assignee.unassigned" }),
  ).toBeVisible();
  expect(screen.queryByText("Saved owner")).not.toBeInTheDocument();
  const count = within(supporting).getByRole("button");
  expect(count.closest("button")?.parentElement?.closest("button")).toBeNull();
  fireEvent.click(count);
  const popup = await screen.findByRole("dialog", {
    name: "tasks:supportingAssignees.label",
  });
  expect(within(popup).getByText("Alice")).toBeVisible();
  expect(within(popup).getByText("Charlie")).toBeVisible();
  expect(within(popup).queryByText("Owner")).toBeNull();
  expect(within(popup).queryByRole("checkbox")).toBeNull();
  expect(onOpenTask).not.toHaveBeenCalled();
  fireEvent.keyDown(popup, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  const childCount = screen.getByRole("group", {
    name: "tasks:supportingAssignees.label: Bob",
  });
  fireEvent.click(within(childCount).getByRole("button"));
  const childPopup = await screen.findByRole("dialog", {
    name: "tasks:supportingAssignees.label",
  });
  expect(within(childPopup).getByText("Bob")).toBeVisible();
  expect(within(childPopup).queryByText("Alice")).toBeNull();
  expect(onOpenTask).not.toHaveBeenCalled();
  fireEvent.keyDown(childPopup, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: /PROJ-1.*Parent/ }));
  expect(onOpenTask).toHaveBeenCalledWith("parent");
});
