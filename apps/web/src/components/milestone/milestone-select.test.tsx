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
import MilestoneSelect from "./milestone-select";

const state = vi.hoisted(() => ({
  fetchNextPage: vi.fn(),
  current: null as null | { id: string; name: string; status: string },
  hasNextPage: false,
}));
vi.mock("@/hooks/queries/milestone/use-milestones", () => ({
  useMilestoneOptions: () => ({
    data: {
      pages: [
        {
          data: [
            { id: "m1", name: "Beta", status: "open" },
            { id: "m2", name: "Launch", status: "closed" },
          ],
        },
      ],
    },
    isLoading: false,
    isError: false,
    hasNextPage: state.hasNextPage,
    isFetchingNextPage: false,
    fetchNextPage: state.fetchNextPage,
  }),
  useMilestone: () => ({ data: state.current }),
}));
const i18n = createInstance();
void i18n.init({
  lng: "en-US",
  resources: { "en-US": resources },
  defaultNS: "common",
  initAsync: false,
});
afterEach(cleanup);
beforeEach(() => {
  state.fetchNextPage.mockClear();
  state.current = null;
  state.hasNextPage = false;
});
function selector(props: {
  value: string | null;
  filter?: boolean;
  bulk?: boolean;
  includeClosed?: boolean;
}) {
  const change = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <MilestoneSelect projectId="p1" onChange={change} {...props} />
    </I18nextProvider>,
  );
  fireEvent.click(screen.getByRole("combobox", { name: "Milestones" }));
  return change;
}
describe("milestone selector", () => {
  it("lets bulk actions clear existing assignments", async () => {
    const change = selector({ value: null, bulk: true });
    const option = await screen.findByRole("option", { name: "No milestone" });
    fireEvent.pointerDown(option, { pointerType: "mouse" });
    fireEvent.click(option);
    expect(change).toHaveBeenCalledWith(null);
  });
  it("keeps a closed current value visible but prevents new assignment to it", async () => {
    state.current = { id: "m2", name: "Launch", status: "closed" };
    selector({ value: "m2" });
    const option = await screen.findByRole("option", {
      name: "Launch (closed)",
    });
    expect(option.getAttribute("aria-disabled")).toBe("true");
  });
  it("uses a distinct filter value for unassigned tasks", async () => {
    const change = selector({ value: null, filter: true, includeClosed: true });
    const option = await screen.findByRole("option", { name: "No milestone" });
    fireEvent.pointerDown(option, { pointerType: "mouse" });
    fireEvent.click(option);
    expect(change).toHaveBeenCalledWith("none");
  });
  it("loads further pages so selectors are not limited to the first hundred milestones", async () => {
    state.hasNextPage = true;
    selector({ value: null });
    await waitFor(() =>
      expect(state.fetchNextPage).toHaveBeenCalledWith({
        cancelRefetch: false,
      }),
    );
  });
});
