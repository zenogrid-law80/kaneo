import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { MattermostIntegrationSettings } from "./mattermost-integration-settings";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  create: vi.fn(),
  integration: null as unknown,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock(
  "@/hooks/queries/mattermost-integration/use-get-mattermost-integration",
  () => ({ default: () => ({ data: mocks.integration, isLoading: false }) }),
);
vi.mock(
  "@/hooks/mutations/mattermost-integration/use-mattermost-integration",
  () => ({
    useCreateMattermostIntegration: () => ({
      mutateAsync: mocks.create,
      isPending: false,
    }),
    useUpdateMattermostIntegration: () => ({
      mutateAsync: mocks.update,
      isPending: false,
    }),
    useDeleteMattermostIntegration: () => ({
      mutateAsync: vi.fn(),
      isPending: false,
    }),
  }),
);
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.integration = {
    id: "integration",
    webhookConfigured: true,
    isActive: true,
    events: { taskCreated: true },
  };
  mocks.create.mockResolvedValue({});
  mocks.update.mockImplementation(async ({ json }) => {
    mocks.integration = { ...(mocks.integration as object), ...json };
    return mocks.integration;
  });
});

it("lets an existing integration turn off and restore Bug creation and assignment notifications", async () => {
  render(<MattermostIntegrationSettings projectId="project" />);
  const creation = screen.getByRole("switch", {
    name: "settings:mattermostIntegration.events.bugCreated",
  });
  const assignment = screen.getByRole("switch", {
    name: "settings:mattermostIntegration.events.bugAssigneesChanged",
  });
  expect(creation).toBeChecked();
  expect(assignment).toBeChecked();
  fireEvent.click(creation);
  fireEvent.click(assignment);
  fireEvent.click(
    screen.getByRole("button", {
      name: "settings:mattermostIntegration.saveChanges",
    }),
  );
  await waitFor(() =>
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project",
        json: expect.objectContaining({
          events: expect.objectContaining({
            bugCreated: false,
            bugAssigneesChanged: false,
            taskCreated: true,
          }),
        }),
      }),
    ),
  );
  fireEvent.click(creation);
  fireEvent.click(assignment);
  fireEvent.click(
    screen.getByRole("button", {
      name: "settings:mattermostIntegration.saveChanges",
    }),
  );
  await waitFor(() =>
    expect(mocks.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        json: expect.objectContaining({
          events: expect.objectContaining({
            bugCreated: true,
            bugAssigneesChanged: true,
          }),
        }),
      }),
    ),
  );
});

it("includes Bug toggles when connecting a new Mattermost integration", async () => {
  mocks.integration = null;
  render(<MattermostIntegrationSettings projectId="project" />);
  fireEvent.change(
    screen.getByLabelText("settings:mattermostIntegration.webhookLabel"),
    { target: { value: "https://mattermost.example/hooks/test" } },
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: "settings:mattermostIntegration.connect",
    }),
  );
  await waitFor(() =>
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          events: expect.objectContaining({
            bugCreated: true,
            bugAssigneesChanged: true,
          }),
        }),
      }),
    ),
  );
});
