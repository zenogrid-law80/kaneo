import {
  fireEvent,
  render,
  screen,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import BugForm from "./bug-form";
vi.mock("./bug-comments", () => ({
  default: () => <section aria-label="Bug comments" />,
}));
vi.mock("./bug-description-editor", () => ({
  default: ({
    value,
    onChange,
    readOnly,
    disabled,
    onUploadingChange,
  }: {
    value: string;
    onChange: (value: string) => void;
    readOnly: boolean;
    disabled: boolean;
    onUploadingChange: (value: boolean) => void;
  }) => (
    <>
      <textarea
        aria-label="tasks:bugs.description"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        readOnly={readOnly}
        disabled={disabled}
      />
      <button type="button" onClick={() => onUploadingChange(true)}>
        Start upload
      </button>
      <button type="button" onClick={() => onUploadingChange(false)}>
        Finish upload
      </button>
    </>
  ),
}));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock(
  "@/hooks/queries/workspace-users/use-get-active-workspace-users",
  () => ({
    useGetActiveWorkspaceUsers: () => ({
      data: {
        members: [
          {
            userId: "member",
            user: {
              id: "member",
              name: "Fixer Person",
              email: "member@example.com",
              image: null,
            },
          },
        ],
      },
      isPending: false,
      isError: false,
    }),
  }),
);
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: { id: "member", name: "Fixer Person" } }),
}));
vi.mock("@/components/milestone/milestone-select", () => ({
  default: ({
    value,
    onChange,
    disabled,
  }: {
    value: string | null;
    onChange: (id: string | null) => void;
    disabled: boolean;
  }) => (
    <select
      aria-label="milestone"
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value || null)}
      disabled={disabled}
    >
      <option value="">None</option>
      <option value="milestone">Release</option>
    </select>
  ),
}));
vi.mock("@/hooks/queries/workspace/use-workspace-teams", () => ({
  default: () => ({ data: [], isPending: false, isError: false }),
}));
afterEach(cleanup);
it("updates the reporter and milestone while retaining untouched assignments", async () => {
  const save = vi.fn().mockResolvedValue({});
  render(
    <BugForm
      projectId="project"
      workspaceId="workspace"
      canAssign
      bug={{
        id: "bug",
        projectId: "project",
        title: "Existing",
        description: "Report",
        status: "new",
        createdAt: "2026-10-30",
        updatedAt: "2026-10-30",
        reporterId: null,
        reporter: null,
        fixerId: null,
        fixer: null,
        verifierId: null,
        verifier: null,
        milestoneId: null,
        milestone: null,
      }}
      onSave={save}
      onClose={vi.fn()}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: "tasks:bugs.reporter: tasks:bugs.unassigned",
    }),
  );
  fireEvent.click(await screen.findByRole("option", { name: /Fixer Person/ }));
  fireEvent.change(screen.getByLabelText("milestone"), {
    target: { value: "milestone" },
  });
  fireEvent.click(screen.getByRole("button", { name: "tasks:bugs.save" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith({
      title: "Existing",
      description: "Report",
      status: "new",
      reporterId: "member",
      milestoneId: "milestone",
    }),
  );
});
it("assigns the fixer and verifier without submitting a reporter override", async () => {
  const save = vi.fn().mockResolvedValue({});
  render(
    <BugForm
      projectId="project"
      workspaceId="workspace"
      canAssign
      onSave={save}
      onClose={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("tasks:bugs.issueTitle"), {
    target: { value: "Assigned bug" },
  });
  for (const role of ["fixer", "verifier"]) {
    fireEvent.click(
      screen.getByRole("button", {
        name: `tasks:bugs.${role}: tasks:bugs.unassigned`,
      }),
    );
    fireEvent.click(
      await screen.findByRole("option", { name: /Fixer Person/ }),
    );
    expect(
      screen.getByRole("button", { name: `tasks:bugs.${role}: Fixer Person` }),
    ).toBeInTheDocument();
  }
  fireEvent.click(screen.getByRole("button", { name: "tasks:bugs.save" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith({
      title: "Assigned bug",
      description: "",
      fixerId: "member",
      verifierId: "member",
    }),
  );
});
it("clears an assignment and locks both selectors when assignment permission is absent", async () => {
  const save = vi.fn().mockResolvedValue({});
  const bug = {
    id: "bug",
    projectId: "project",
    milestoneId: null,
    milestone: null,
    title: "Assigned",
    description: "Report",
    status: "new" as const,
    createdAt: "2026-10-30",
    updatedAt: "2026-10-30",
    reporterId: "reporter",
    reporter: { id: "reporter", name: "Reporter Person", image: null },
    fixerId: "member",
    fixer: { id: "member", name: "Fixer Person", image: null },
    verifierId: null,
    verifier: null,
  };
  const view = render(
    <BugForm
      projectId="project"
      workspaceId="workspace"
      bug={bug}
      onSave={save}
      onClose={vi.fn()}
    />,
  );
  expect(
    screen.getByRole("button", {
      name: "tasks:bugs.reporter: Reporter Person",
    }),
  ).toHaveTextContent("Reporter Person");
  expect(
    screen.getByRole("button", { name: "tasks:bugs.fixer: Fixer Person" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", {
      name: "tasks:bugs.verifier: tasks:bugs.unassigned",
    }),
  ).toBeDisabled();
  view.rerender(
    <BugForm
      projectId="project"
      workspaceId="workspace"
      bug={bug}
      canAssign
      onSave={save}
      onClose={vi.fn()}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "tasks:bugs.fixer: Fixer Person" }),
  );
  fireEvent.click(
    await screen.findByRole("option", {
      name: /tasks:popover.assignee.unassigned/,
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "tasks:bugs.save" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith({
      title: "Assigned",
      description: "Report",
      status: "new",
      fixerId: null,
    }),
  );
});
it("fills new reports from the project template and submits user edits without a status override", async () => {
  const save = vi.fn().mockResolvedValue({});
  const close = vi.fn();
  render(
    <BugForm
      projectId="project"
      workspaceId="workspace"
      template={"## Reproduce\n1. "}
      onSave={save}
      onClose={close}
    />,
  );
  expect(screen.getByLabelText("tasks:bugs.description")).toHaveValue(
    "## Reproduce\n1. ",
  );
  expect(screen.queryByLabelText("tasks:bugs.status")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("tasks:bugs.issueTitle"), {
    target: { value: " Broken button " },
  });
  fireEvent.change(screen.getByLabelText("tasks:bugs.description"), {
    target: { value: "Click Save twice" },
  });
  fireEvent.click(screen.getByRole("button", { name: "tasks:bugs.save" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith({
      title: "Broken button",
      description: "Click Save twice",
    }),
  );
  expect(close).toHaveBeenCalled();
});
it("keeps the report and dialog open when saving fails", async () => {
  const close = vi.fn();
  render(
    <BugForm
      projectId="project"
      workspaceId="workspace"
      template="Reproduction"
      onSave={vi.fn().mockRejectedValue(new Error("Failed"))}
      onClose={close}
    />,
  );
  fireEvent.change(screen.getByLabelText("tasks:bugs.issueTitle"), {
    target: { value: "Bug" },
  });
  fireEvent.click(screen.getByRole("button", { name: "tasks:bugs.save" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "tasks:bugs.saveError",
  );
  expect(screen.getByLabelText("tasks:bugs.description")).toHaveValue(
    "Reproduction",
  );
  expect(close).not.toHaveBeenCalled();
});
it("reads an existing report without replacing it with a changed template and hides save for viewers", () => {
  render(
    <BugForm
      projectId="project"
      workspaceId="workspace"
      bug={{
        id: "bug",
        projectId: "project",
        milestoneId: null,
        milestone: null,
        reporterId: null,
        fixerId: null,
        verifierId: null,
        reporter: null,
        fixer: null,
        verifier: null,
        title: "Existing",
        description: "Original report",
        status: "resolved",
        createdAt: "2026-10-30",
        updatedAt: "2026-10-30",
      }}
      template="New template"
      readOnly
      onSave={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  expect(screen.getByLabelText("tasks:bugs.description")).toHaveValue(
    "Original report",
  );
  expect(screen.getByLabelText("tasks:bugs.description")).toHaveAttribute(
    "readonly",
  );
  expect(
    screen.queryByRole("button", { name: "tasks:bugs.save" }),
  ).not.toBeInTheDocument();
});

it("changes an existing bug status and can reopen a resolved report", async () => {
  const save = vi.fn().mockResolvedValue({});
  render(
    <BugForm
      projectId="project"
      workspaceId="workspace"
      bug={{
        id: "bug",
        projectId: "project",
        milestoneId: null,
        milestone: null,
        reporterId: null,
        fixerId: null,
        verifierId: null,
        reporter: null,
        fixer: null,
        verifier: null,
        title: "Existing",
        description: "Original report",
        status: "resolved",
        createdAt: "2026-10-30",
        updatedAt: "2026-10-30",
      }}
      onSave={save}
      onClose={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("radio", { name: "tasks:bugs.inProgress" }));
  fireEvent.click(screen.getByRole("button", { name: "tasks:bugs.save" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith({
      title: "Existing",
      description: "Original report",
      status: "in-progress",
    }),
  );
});

it("refreshes untouched fields from realtime while preserving the user's draft", () => {
  const bug = {
    id: "bug",
    projectId: "project",
    milestoneId: null,
    milestone: null,
    reporterId: null,
    fixerId: null,
    verifierId: null,
    reporter: null,
    fixer: null,
    verifier: null,
    title: "Existing",
    description: "Original report",
    status: "new" as const,
    createdAt: "2026-10-30",
    updatedAt: "2026-10-30",
  };
  const props = { onSave: vi.fn(), onClose: vi.fn() };
  const view = render(
    <BugForm
      projectId="project"
      workspaceId="workspace"
      bug={bug}
      {...props}
    />,
  );
  fireEvent.change(screen.getByLabelText("tasks:bugs.description"), {
    target: { value: "My draft" },
  });
  view.rerender(
    <BugForm
      projectId="project"
      workspaceId="workspace"
      bug={{
        ...bug,
        title: "Updated remotely",
        status: "resolved",
        description: "Remote report",
      }}
      {...props}
    />,
  );
  expect(screen.getByLabelText("tasks:bugs.issueTitle")).toHaveValue(
    "Updated remotely",
  );
  expect(
    screen.getByRole("radio", { name: "tasks:bugs.resolved" }),
  ).toBeChecked();
  expect(screen.getByLabelText("tasks:bugs.description")).toHaveValue(
    "My draft",
  );
});

it("prevents save and close until attachments finish and rejects oversized descriptions", async () => {
  const save = vi.fn().mockResolvedValue({});
  const close = vi.fn();
  render(
    <BugForm
      projectId="project"
      workspaceId="workspace"
      onSave={save}
      onClose={close}
    />,
  );
  fireEvent.change(screen.getByLabelText("tasks:bugs.issueTitle"), {
    target: { value: "Evidence" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Start upload" }));
  expect(
    screen.getByRole("button", { name: "tasks:bugs.save" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "common:actions.close" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Finish upload" }));
  fireEvent.change(screen.getByLabelText("tasks:bugs.description"), {
    target: { value: "x".repeat(50001) },
  });
  expect(screen.getByRole("alert")).toHaveTextContent(
    "tasks:bugs.descriptionTooLong",
  );
  expect(
    screen.getByRole("button", { name: "tasks:bugs.save" }),
  ).toBeDisabled();
  fireEvent.change(screen.getByLabelText("tasks:bugs.description"), {
    target: { value: "## Evidence\n![image](/api/asset/example)" },
  });
  fireEvent.click(screen.getByRole("button", { name: "tasks:bugs.save" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith({
      title: "Evidence",
      description: "## Evidence\n![image](/api/asset/example)",
    }),
  );
});
