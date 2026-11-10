import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import BugEnvironmentSettings from "./bug-environment-settings";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/fetchers/bug", () => ({
  getBugEnvironments: mocks.get,
  createBugEnvironment: mocks.create,
  updateBugEnvironment: mocks.update,
}));
vi.mock("react-i18next", async (original) => ({
  ...(await original<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
let client: QueryClient;
let items: { id: string; name: string | null; archived: boolean }[];
beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  items = [{ id: "production", name: null, archived: false }];
  mocks.get.mockImplementation(async () => items.map((item) => ({ ...item })));
  mocks.create.mockImplementation(async (_projectId, name: string) => {
    const item = { id: "custom", name, archived: false };
    items.push(item);
    return item;
  });
  mocks.update.mockImplementation(async (_projectId, id: string, changes) => {
    const item = items.find((row) => row.id === id)!;
    Object.assign(item, changes);
    return item;
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
      <BugEnvironmentSettings projectId="project" canEdit={canEdit} />
    </QueryClientProvider>,
  );
}

it("adds, renames, deletes and restores an environment", async () => {
  mount();
  const add = await screen.findByLabelText(
    "tasks:bugs.environmentSettingsTitle",
  );
  fireEvent.change(add, { target: { value: "QA" } });
  fireEvent.click(
    screen.getByRole("button", { name: "tasks:bugs.environmentAdd" }),
  );
  const qa = await waitFor(() => {
    const result = screen
      .getAllByDisplayValue("QA")
      .find((element) => element.closest("li"));
    if (!result) throw new Error("Environment row not loaded");
    return result;
  });
  const row = qa.closest("li")!;
  fireEvent.change(qa, { target: { value: "QA 2" } });
  fireEvent.click(
    within(row).getByRole("button", { name: /tasks:bugs.environmentRename/ }),
  );
  await waitFor(() =>
    expect(mocks.update).toHaveBeenCalledWith("project", "custom", {
      name: "QA 2",
      archived: undefined,
    }),
  );
  await waitFor(() =>
    expect(screen.getByDisplayValue("QA 2")).toBeInTheDocument(),
  );
  fireEvent.click(
    within(row).getByRole("button", { name: /tasks:bugs.environmentDelete/ }),
  );
  await waitFor(() =>
    expect(
      within(row).getByRole("button", {
        name: /tasks:bugs.environmentRestore/,
      }),
    ).toBeInTheDocument(),
  );
  fireEvent.click(
    within(row).getByRole("button", { name: /tasks:bugs.environmentRestore/ }),
  );
  await waitFor(() =>
    expect(
      within(row).getByRole("button", { name: /tasks:bugs.environmentDelete/ }),
    ).toBeInTheDocument(),
  );
});
it("shows environments read-only without project update permission", async () => {
  mount(false);
  const row = (
    await screen.findByDisplayValue("tasks:bugs.environments.production")
  ).closest("li")!;
  expect(within(row).getByRole("textbox")).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: /tasks:bugs.environmentDelete/ }),
  ).not.toBeInTheDocument();
});
