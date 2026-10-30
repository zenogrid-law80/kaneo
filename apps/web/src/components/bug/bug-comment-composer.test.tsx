import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import BugCommentComposer from "./bug-comment-composer";
const mocks = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/upload-bug-asset", () => ({ uploadBugAsset: mocks.upload }));
vi.mock("@/components/activity/comment-editor", () => ({
  default: ({
    value,
    onChange,
    disabled,
    uploadAsset,
    onSubmitShortcut,
  }: {
    value: string;
    onChange: (value: string) => void;
    disabled: boolean;
    uploadAsset: (file: File) => Promise<unknown>;
    onSubmitShortcut: () => void;
  }) => (
    <div>
      <textarea
        aria-label="comment"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={async () => {
          await uploadAsset(new File(["image"], "test.png"));
          onChange(`${value}\n![proof](/api/asset/id)`);
        }}
      >
        Attach
      </button>
      <button type="button" onClick={onSubmitShortcut}>
        Shortcut
      </button>
    </div>
  ),
}));
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());
function setup(overrides = {}) {
  const save = vi.fn().mockResolvedValue({});
  const parentSubmit = vi.fn((event) => event.preventDefault());
  const busy = vi.fn();
  render(
    <form onSubmit={parentSubmit}>
      <BugCommentComposer
        projectId="project"
        bugId="bug"
        disabled={false}
        onSave={save}
        onBusyChange={busy}
        {...overrides}
      />
    </form>,
  );
  const input = screen.getByRole("textbox", { name: "comment" });
  const button = screen.getByRole("button", { name: "tasks:bugs.addComment" });
  return { save, parentSubmit, busy, input, button };
}
it("saves independently from the Bug form, clears only on success and rejects empty/oversized content", async () => {
  const { save, parentSubmit, input, button } = setup();
  expect(button).toBeDisabled();
  fireEvent.change(input, { target: { value: " ".repeat(3) } });
  expect(button).toBeDisabled();
  fireEvent.change(input, { target: { value: "x".repeat(10001) } });
  expect(button).toBeDisabled();
  fireEvent.change(input, { target: { value: "## Test" } });
  fireEvent.click(button);
  await waitFor(() => expect(input).toHaveValue(""));
  expect(save).toHaveBeenCalledWith("## Test");
  expect(parentSubmit).not.toHaveBeenCalled();
});
it("keeps the draft and shows an error when saving fails", async () => {
  const save = vi.fn().mockRejectedValue(new Error("offline"));
  const { input, button } = setup({ onSave: save });
  fireEvent.change(input, { target: { value: "Keep my draft" } });
  fireEvent.click(button);
  await screen.findByRole("alert");
  expect(input).toHaveValue("Keep my draft");
  expect(button).toBeEnabled();
});
it("blocks button and keyboard submission until the upload finishes and balances dialog busy state", async () => {
  let resolveUpload!: (value: unknown) => void;
  mocks.upload.mockReturnValue(
    new Promise((resolve) => {
      resolveUpload = resolve;
    }),
  );
  const { save, busy, input, button } = setup();
  fireEvent.change(input, { target: { value: "Evidence" } });
  fireEvent.click(screen.getByRole("button", { name: "Attach" }));
  expect(button).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Shortcut" }));
  expect(save).not.toHaveBeenCalled();
  await act(async () => {
    resolveUpload({ url: "/api/asset/id" });
  });
  fireEvent.click(button);
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith("Evidence\n![proof](/api/asset/id)"),
  );
  await waitFor(() => expect(input).toHaveValue(""));
  expect(busy.mock.calls.reduce((total, [change]) => total + change, 0)).toBe(
    0,
  );
});
