import { Editor } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { afterEach, expect, it } from "vite-plus/test";
import { createEditorExtensions } from "@/components/editor/extensions";
import {
  parseBugMarkdown,
  prepareBugMarkdown,
  prepareBugTemplate,
  serializeBugMarkdown,
} from "./bug-markdown";

const editors: Editor[] = [];
function makeEditor(markdown: string) {
  const editor = new Editor({
    extensions: createEditorExtensions({
      placeholder: "",
      highlighter: () => null,
      resolveLanguage: (language) => language,
      image: Image,
    }),
  });
  editors.push(editor);
  editor.commands.setContent(parseBugMarkdown(editor, markdown));
  return editor;
}
afterEach(() => editors.splice(0).forEach((editor) => editor.destroy()));

it("keeps empty numbered items and blank writing space after an edit and reload", () => {
  const input =
    "## 재연 과정\n1. \n2. \n3. \n \n## 현재 현상\n \n \n## 기대 효과\n \n \n## 환경\n- 게임 버전:\n- OS:";
  const editor = makeEditor(input);
  expect(
    editor.getJSON().content?.find((node) => node.type === "orderedList")
      ?.content,
  ).toHaveLength(3);
  const initial = editor.getJSON();
  const saved = serializeBugMarkdown(editor);
  const reloaded = makeEditor(saved);
  expect(reloaded.getJSON()).toEqual(initial);
  expect(makeEditor(serializeBugMarkdown(reloaded)).getJSON()).toEqual(initial);
});

it("keeps normal content and fenced code untouched", () => {
  const markdown =
    "## Title\n\n```text\none\n\n\ntwo\n```\n\n1. first\n2. second";
  expect(prepareBugMarkdown(markdown)).toBe(markdown);
  const editor = makeEditor(markdown);
  expect(makeEditor(serializeBugMarkdown(editor)).getJSON()).toEqual(
    editor.getJSON(),
  );
});

it("preserves consecutive hard breaks in and at the end of text", () => {
  const editor = makeEditor("start");
  editor.commands.setContent({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "first" },
          { type: "hardBreak" },
          { type: "hardBreak" },
          { type: "text", text: "last" },
          { type: "hardBreak" },
        ],
      },
    ],
  });
  const before = editor.getJSON();
  const saved = serializeBugMarkdown(editor);
  expect(makeEditor(saved).getJSON()).toEqual(before);
});

it("preserves hard breaks inside numbered items and empty paragraphs", () => {
  const editor = makeEditor("1. item");
  editor.commands.setContent({
    type: "doc",
    content: [
      {
        type: "orderedList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "line" },
                  { type: "hardBreak" },
                  { type: "hardBreak" },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "paragraph",
        content: [{ type: "hardBreak" }, { type: "hardBreak" }],
      },
    ],
  });
  const before = editor.getJSON();
  expect(makeEditor(serializeBugMarkdown(editor)).getJSON()).toEqual(before);
});

it("keeps each blank line around template headings, including a single separator", () => {
  const template =
    "## 재연 과정\n1. \n2. \n3. \n \n## 현재 현상\n \n \n## 기대 효과\n \n \n## 환경";
  const editor = makeEditor(prepareBugTemplate(template));
  const blocks = editor.getJSON().content ?? [];
  const current = blocks.findIndex(
    (node) =>
      node.type === "heading" &&
      node.content?.[0] &&
      "text" in node.content[0] &&
      node.content[0].text === "현재 현상",
  );
  const expected = blocks.findIndex(
    (node) =>
      node.type === "heading" &&
      node.content?.[0] &&
      "text" in node.content[0] &&
      node.content[0].text === "기대 효과",
  );
  expect(blocks[current - 1]).toMatchObject({ type: "paragraph" });
  expect(expected - current - 1).toBe(2);
  expect(makeEditor(serializeBugMarkdown(editor)).getJSON()).toEqual(
    editor.getJSON(),
  );
});
