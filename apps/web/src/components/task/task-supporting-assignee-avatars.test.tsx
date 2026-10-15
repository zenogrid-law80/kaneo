import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import TaskSupportingAssigneeAvatars from "./task-supporting-assignee-avatars";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: () => "보조 담당자",
  }),
}));
afterEach(cleanup);

it.each([
  ["small", "h-5", "w-5"],
  ["default", "h-6", "w-6"],
] as const)(
  "renders named avatar icons in %s size without duplicating the primary assignee",
  (size, height, width) => {
    render(
      <TaskSupportingAssigneeAvatars
        size={size}
        task={{
          userId: "owner",
          supportingAssignees: [
            { userId: "owner", name: "Owner" },
            { userId: "a", name: "Alice" },
            { userId: "a", name: "Alice" },
            { userId: "b", name: "Bob" },
            { userId: "c", name: "Charlie" },
            { userId: "d", name: "David" },
          ],
        }}
      />,
    );
    const group = screen.getByRole("group", {
      name: "보조 담당자: Alice, Bob, Charlie, David",
    });
    expect(group).toHaveAttribute(
      "title",
      "보조 담당자: Alice, Bob, Charlie, David",
    );
    expect(screen.getAllByRole("img")).toHaveLength(3);
    for (const name of ["Alice", "Bob", "Charlie"]) {
      const icon = screen.getByRole("img", { name: `보조 담당자: ${name}` });
      expect(icon).toHaveClass(height, width);
      expect(icon).toHaveAttribute("title", `보조 담당자: ${name}`);
    }
    expect(screen.getByText("+1")).toHaveClass(height, width);
    expect(
      screen.queryByRole("img", { name: /Owner/ }),
    ).not.toBeInTheDocument();
  },
);

it("renders no avatar group when supporting assignments are empty", () => {
  const { container } = render(
    <TaskSupportingAssigneeAvatars task={{ userId: null }} />,
  );
  expect(container).toBeEmptyDOMElement();
});

it("summarizes all supporting members as a count without showing their avatars", () => {
  render(
    <TaskSupportingAssigneeAvatars
      display="count"
      task={{
        userId: "owner",
        supportingAssignees: [
          { userId: "owner", name: "Owner" },
          { userId: "a", name: "Alice" },
          { userId: "a", name: "Alice" },
          { userId: "b", name: "Bob" },
        ],
      }}
    />,
  );
  const count = screen.getByRole("group", { name: "보조 담당자: Alice, Bob" });
  expect(count).toHaveTextContent("+2");
  expect(count).toHaveAttribute("title", "보조 담당자: Alice, Bob");
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
