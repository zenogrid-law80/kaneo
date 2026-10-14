import resources from "@i18n/en-US.json";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { afterEach, expect, it, vi } from "vite-plus/test";
import NewTaskMilestoneField from "./new-task-milestone-field";

vi.mock("@/hooks/queries/milestone/use-current-milestone", () => ({
  useCurrentMilestone: (projectId: string) => ({
    data: { id: projectId === "p1" ? "beta" : "next" },
    isPending: false,
  }),
}));
vi.mock("@/hooks/queries/milestone/use-milestones", () => ({
  useMilestoneOptions: () => ({
    data: {
      pages: [
        {
          data: [
            { id: "beta", name: "Beta", status: "open" },
            { id: "next", name: "Next", status: "open" },
          ],
        },
      ],
    },
  }),
  useMilestone: () => ({ data: undefined }),
}));
const i18n = createInstance();
void i18n.init({
  lng: "en-US",
  resources: { "en-US": resources },
  defaultNS: "common",
  initAsync: false,
});
afterEach(cleanup);

it("displays each project's default and supports explicit no milestone and restoring the default", async () => {
  const change = vi.fn();
  const field = (projectId: string, value: string | null | undefined) => (
    <I18nextProvider i18n={i18n}>
      <NewTaskMilestoneField
        projectId={projectId}
        value={value}
        onChange={change}
      />
    </I18nextProvider>
  );
  const { rerender } = render(field("p1", undefined));
  expect(
    screen.getByRole("combobox", { name: "Milestones" }).textContent,
  ).toContain("Beta");
  fireEvent.click(screen.getByRole("combobox", { name: "Milestones" }));
  const none = await screen.findByRole("option", { name: "No milestone" });
  fireEvent.pointerDown(none, { pointerType: "mouse" });
  fireEvent.click(none);
  expect(change).toHaveBeenLastCalledWith(null);
  rerender(field("p1", null));
  expect(
    screen.getByRole("combobox", { name: "Milestones" }).textContent,
  ).toContain("No milestone");
  fireEvent.click(screen.getByRole("button", { name: "Use default" }));
  expect(change).toHaveBeenLastCalledWith(undefined);
  rerender(field("p2", undefined));
  expect(
    screen.getByRole("combobox", { name: "Milestones" }).textContent,
  ).toContain("Next");
  rerender(field("p2", "beta"));
  expect(
    screen.getByRole("combobox", { name: "Milestones" }).textContent,
  ).toContain("Beta");
});
