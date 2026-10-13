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
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Milestone } from "@/fetchers/milestone";
import MilestoneForm from "./milestone-form";

const i18n = createInstance();
void i18n.init({
  lng: "en-US",
  resources: { "en-US": resources },
  defaultNS: "common",
  initAsync: false,
});
afterEach(cleanup);
const milestone: Milestone = {
  id: "milestone",
  projectId: "project",
  name: "Beta",
  description: null,
  dueDate: "2026-10-15",
  status: "open",
  closedAt: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  totalTasks: 0,
  completedTasks: 0,
  archivedTasks: 0,
  progressPercent: 0,
};
function form(
  save: (input: unknown) => Promise<unknown>,
  close = vi.fn(),
  existing?: Milestone,
) {
  render(
    <I18nextProvider i18n={i18n}>
      <MilestoneForm milestone={existing} onSave={save} onClose={close} />
    </I18nextProvider>,
  );
  return close;
}
describe("milestone form", () => {
  it("saves trimmed names and calendar dates without converting to UTC", async () => {
    const save = vi.fn().mockResolvedValue({});
    const close = form(save, vi.fn(), milestone);
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: " Beta " },
    });
    fireEvent.click(screen.getByLabelText("Target date"));
    fireEvent.click(
      await screen.findByRole("button", { name: /October 31st, 2026/ }),
    );
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        name: "Beta",
        description: null,
        dueDate: "2026-10-31",
      }),
    );
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  });
  it("clears an existing target date without submitting the form", async () => {
    const save = vi.fn().mockResolvedValue({});
    form(save, vi.fn(), milestone);
    fireEvent.click(screen.getByLabelText("Target date"));
    fireEvent.click(await screen.findByRole("button", { name: "Clear date" }));
    expect(screen.getByLabelText("Target date").textContent).toBe(
      "No target date",
    );
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        name: "Beta",
        description: null,
        dueDate: null,
      }),
    );
  });
  it("keeps entered values and displays a failed save in the dialog", async () => {
    const save = vi.fn().mockRejectedValue(new Error("Server unavailable"));
    const close = form(save);
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Delivery" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Do not lose this" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("Server unavailable"),
    );
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(
      "Delivery",
    );
    expect(
      (screen.getByLabelText("Description") as HTMLTextAreaElement).value,
    ).toBe("Do not lose this");
    expect(close).not.toHaveBeenCalled();
  });
});
