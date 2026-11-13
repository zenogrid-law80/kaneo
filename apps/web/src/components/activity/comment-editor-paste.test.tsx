import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { Extension } from "@tiptap/core";
import TaskItem from "@tiptap/extension-task-item";
import { describe, expect, it, vi } from "vite-plus/test";
import CommentEditor from "./comment-editor";

const { t } = vi.hoisted(() => ({ t: (key: string) => key }));

function inert(name: string) {
  return Extension.create({ name });
}

vi.mock("@/components/task/extensions/shiki-code-block", () => ({
  ShikiCodeBlock: inert("shikiCodeBlockStub"),
}));
vi.mock("@/components/task/extensions/mermaid-block", () => ({
  MermaidBlock: inert("mermaidBlockStub"),
}));
vi.mock("@/components/task/extensions/embed-block", () => ({
  EmbedBlock: inert("embedBlockStub"),
}));
vi.mock("@/components/task/extensions/attachment-card", () => ({
  AttachmentCard: inert("attachmentCardStub"),
}));
vi.mock("@/components/task/extensions/kaneo-issue-link", () => ({
  KaneoIssueLink: inert("kaneoIssueLinkStub"),
}));
vi.mock("@/components/task/extensions/kaneo-mention", () => ({
  KaneoMention: inert("kaneoMentionStub"),
}));
vi.mock("@/components/task/extensions/mention-suggestion", () => ({
  MentionSuggestion: inert("mentionSuggestionStub"),
}));
vi.mock("@/components/task/extensions/task-item-with-checkbox", () => ({
  TaskItemWithCheckbox: TaskItem,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: undefined }),
}));
vi.mock(
  "@/hooks/queries/workspace-users/use-get-active-workspace-users",
  () => ({
    useGetActiveWorkspaceUsers: () => ({ data: undefined }),
  }),
);
vi.mock("@/lib/shiki-highlighter", () => ({
  getSharedShikiHighlighter: () => new Promise(() => {}),
}));

describe("CommentEditor paste", () => {
  it("pastes Markdown into the current editor after it is recreated", async () => {
    const onChange = vi.fn();
    const props = {
      value: "",
      onChange,
      taskId: "task-1",
      placeholder: "first",
    };
    const { container, rerender } = render(<CommentEditor {...props} />);
    await waitFor(() =>
      expect(
        container.querySelector('[contenteditable="true"]'),
      ).not.toBeNull(),
    );
    const firstEditable = container.querySelector('[contenteditable="true"]');

    rerender(<CommentEditor {...props} placeholder="second" />);
    const currentEditable = container.querySelector<HTMLElement>(
      '[contenteditable="true"]',
    );
    expect(currentEditable).not.toBe(firstEditable);
    if (!currentEditable) throw new Error("Editor missing");
    await act(async () => {});

    fireEvent.paste(currentEditable, {
      clipboardData: {
        files: [],
        getData: (type: string) =>
          type === "text/plain" ? "**copied text**" : "",
      },
    });

    expect(currentEditable.querySelector("strong")?.textContent).toBe(
      "copied text",
    );
    expect(onChange).toHaveBeenCalledWith("**copied text**");
  });
});
