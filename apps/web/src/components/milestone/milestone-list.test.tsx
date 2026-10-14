import resources from "@i18n/en-US.json";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import type { Milestone } from "@/fetchers/milestone";
import MilestoneList from "./milestone-list";

const state = vi.hoisted(() => ({
  current: null as { id: string; name: string } | null,
  pending: false,
  loading: false,
  error: false,
  update: vi.fn(),
  refetch: vi.fn(),
}));
vi.mock("@/hooks/queries/milestone/use-current-milestone", () => ({
  useCurrentMilestone: () => ({
    data: state.current,
    isPending: state.loading,
    isFetching: state.loading,
    isError: state.error,
    refetch: state.refetch,
  }),
}));
vi.mock("@/hooks/mutations/milestone/use-milestone-mutations", () => ({
  useMilestoneMutations: () => ({
    update: { mutateAsync: state.update, isPending: state.pending },
  }),
}));
const i18n = createInstance();
void i18n.init({
  lng: "en-US",
  resources: { "en-US": resources },
  defaultNS: "common",
  initAsync: false,
});
const milestone: Milestone = {
  id: "beta",
  projectId: "project",
  name: "Beta",
  description: null,
  dueDate: null,
  status: "open",
  isCurrent: false,
  closedAt: null,
  createdAt: "2026-10-14T00:00:00.000Z",
  updatedAt: "2026-10-14T00:00:00.000Z",
  totalTasks: 2,
  completedTasks: 1,
  archivedTasks: 0,
  progressPercent: 50,
};
const next = { ...milestone, id: "next", name: "Next release" };
function list({
  manage = true,
  status = "open",
  onSelect = vi.fn(),
}: {
  manage?: boolean;
  status?: "open" | "closed";
  onSelect?: (id: string) => void;
} = {}) {
  return (
    <I18nextProvider i18n={i18n}>
      <MilestoneList
        projectId="project"
        milestones={[milestone, next]}
        today="2026-10-14"
        canManage={manage}
        status={status}
        onSelect={onSelect}
      />
    </I18nextProvider>
  );
}
afterEach(cleanup);
beforeEach(() => {
  state.current = { id: "beta", name: "Beta" };
  state.pending = false;
  state.loading = false;
  state.error = false;
  state.update.mockReset().mockResolvedValue({});
  state.refetch.mockReset();
});

describe("current milestone selection from the list", () => {
  it("changes the current milestone without opening details and keeps detail navigation separate", async () => {
    const onSelect = vi.fn();
    const { rerender } = render(list({ onSelect }));
    expect(
      screen.getByRole("radio", { name: "Beta" }).getAttribute("aria-checked"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "Next release" }));
    await waitFor(() =>
      expect(state.update).toHaveBeenCalledWith({
        id: "next",
        input: { isCurrent: true },
      }),
    );
    expect(onSelect).not.toHaveBeenCalled();
    state.current = { id: "next", name: "Next release" };
    rerender(list({ onSelect }));
    expect(
      screen
        .getByRole("radio", { name: "Next release" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen.getByRole("radio", { name: "Beta" }).getAttribute("aria-checked"),
    ).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Beta" }));
    expect(onSelect).toHaveBeenCalledWith("beta");
    expect(state.update).toHaveBeenCalledTimes(1);
  });

  it("shows and clears the current milestone even when it is on a different page", async () => {
    state.current = { id: "other-page", name: "Earlier release" };
    const { rerender } = render(list());
    expect(screen.getByText("Current milestone: Earlier release")).toBeTruthy();
    expect(
      screen
        .getByRole("radio", { name: "None selected" })
        .getAttribute("aria-checked"),
    ).toBe("false");
    fireEvent.click(screen.getByRole("radio", { name: "None selected" }));
    await waitFor(() =>
      expect(state.update).toHaveBeenCalledWith({
        id: "other-page",
        input: { isCurrent: false },
      }),
    );
    state.current = null;
    rerender(list());
    expect(
      screen
        .getByRole("radio", { name: "None selected" })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  it.each([{ manage: false }, { status: "closed" as const }])(
    "does not offer selection when %j",
    (props) => {
      const onSelect = vi.fn();
      render(list({ ...props, onSelect }));
      expect(screen.queryByRole("radiogroup")).toBeNull();
      expect(screen.queryAllByRole("radio")).toHaveLength(0);
      fireEvent.click(screen.getByRole("button", { name: "Beta" }));
      expect(onSelect).toHaveBeenCalledWith("beta");
      expect(state.update).not.toHaveBeenCalled();
    },
  );

  it("keeps the previous selection and shows a failed update", async () => {
    state.update.mockRejectedValue(new Error("Could not save milestone"));
    render(list());
    fireEvent.click(screen.getByRole("radio", { name: "Next release" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Could not save milestone",
    );
    expect(
      screen.getByRole("radio", { name: "Beta" }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it.each(["pending", "loading", "error"] as const)(
    "prevents changes while %s",
    (condition) => {
      state[condition] = true;
      render(list());
      const option = screen.getByRole("radio", { name: "Next release" });
      expect(option.getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(option);
      expect(state.update).not.toHaveBeenCalled();
      if (condition === "error") {
        fireEvent.click(screen.getByRole("button", { name: "Retry" }));
        expect(state.refetch).toHaveBeenCalled();
      }
    },
  );
});
