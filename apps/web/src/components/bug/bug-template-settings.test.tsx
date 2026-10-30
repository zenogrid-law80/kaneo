import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import BugTemplateSettings from "./bug-template-settings";
const mocks = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }));
vi.mock("@/fetchers/bug", () => ({
  getBugTemplate: mocks.get,
  updateBugTemplate: mocks.update,
}));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  mocks.get.mockResolvedValue({ template: "Default report", isDefault: true });
  mocks.update.mockImplementation(async (_projectId, template) => {
    const result = {
      template: template ?? "Default report",
      isDefault: template === null,
    };
    mocks.get.mockResolvedValue(result);
    return result;
  });
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.resetAllMocks();
});
function mount(canEdit = true) {
  render(
    <QueryClientProvider client={client}>
      <BugTemplateSettings projectId="project" canEdit={canEdit} />
    </QueryClientProvider>,
  );
}
it("saves and restores a project template with visible confirmation", async () => {
  mount();
  const field = await screen.findByLabelText("tasks:bugs.templateTitle");
  expect(field).toHaveValue("Default report");
  fireEvent.change(field, { target: { value: "Custom reproduction steps" } });
  fireEvent.click(
    screen.getByRole("button", { name: "tasks:bugs.saveTemplate" }),
  );
  await waitFor(() =>
    expect(mocks.update).toHaveBeenCalledWith(
      "project",
      "Custom reproduction steps",
    ),
  );
  expect(await screen.findByRole("status")).toHaveTextContent(
    "tasks:bugs.templateSaved",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "tasks:bugs.resetTemplate" }),
  );
  await waitFor(() => expect(field).toHaveValue("Default report"));
  expect(mocks.update).toHaveBeenLastCalledWith("project", null);
});
it("preserves an unsaved template after an error", async () => {
  mocks.update.mockRejectedValue(new Error("Offline"));
  mount();
  const field = await screen.findByLabelText("tasks:bugs.templateTitle");
  fireEvent.change(field, { target: { value: "Keep this draft" } });
  fireEvent.click(
    screen.getByRole("button", { name: "tasks:bugs.saveTemplate" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "tasks:bugs.saveError",
  );
  expect(field).toHaveValue("Keep this draft");
});
it("shows templates read-only without project update permission", async () => {
  mount(false);
  expect(
    await screen.findByLabelText("tasks:bugs.templateTitle"),
  ).toHaveAttribute("readonly");
  expect(
    screen.queryByRole("button", { name: "tasks:bugs.saveTemplate" }),
  ).not.toBeInTheDocument();
});
