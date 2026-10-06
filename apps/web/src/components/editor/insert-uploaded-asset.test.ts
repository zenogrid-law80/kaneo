import { Editor } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createEditorExtensions } from "./extensions";
import { insertUploadedAsset } from "./insert-uploaded-asset";

const videoAsset = {
  url: "https://example.com/recording.mp4",
  alt: "recording",
  filename: "recording.mp4",
  kind: "attachment",
  mimeType: "video/mp4",
  size: 1024,
};

const editors: Editor[] = [];

function buildEditor(content: string, editable = true) {
  const editor = new Editor({
    extensions: createEditorExtensions({
      placeholder: "",
      highlighter: () => null,
      resolveLanguage: (language) => language,
      image: Image,
    }),
    content: "",
    editable,
  });
  editor.commands.setContent(content, { contentType: "markdown" });
  editors.push(editor);
  return editor;
}

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});

describe("uploaded video in shared editor extensions", () => {
  it("keeps a writable paragraph and persists text beneath a block upload", () => {
    const editor = buildEditor("text before video");
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);

    insertUploadedAsset(editor, videoAsset, "Upload failed");

    expect(editor.getJSON().content?.map((node) => node.type)).toEqual([
      "paragraph",
      "attachmentCard",
      "paragraph",
    ]);
    editor.commands.insertContent("saved below video");
    const markdown = editor.getMarkdown();
    editor.commands.setContent(markdown, { contentType: "markdown" });

    expect(editor.getText()).toContain("saved below video");
    expect(editor.getJSON().content?.[1]?.attrs?.mimeType).toBe("video/mp4");
    expect(editor.getJSON().content?.[2]?.content?.[0]).toMatchObject({
      type: "text",
      text: "saved below video",
    });
  });

  it("allows typing below a saved video-only description", () => {
    const editor = buildEditor(
      '<kaneo-attachment url="https://example.com/recording.mp4" filename="recording.mp4" mime-type="video/mp4" size="1024" />',
    );

    expect(editor.state.doc.lastChild?.type.name).toBe("paragraph");
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.commands.insertContent("new text");
    expect(editor.getText()).toContain("new text");
  });

  it("preserves read-only descriptions when inserting a hard break", () => {
    const editor = buildEditor("read only description", false);
    const before = editor.getJSON();

    expect(editor.commands.setHardBreak()).toBe(false);
    expect(editor.getJSON()).toEqual(before);
  });
});
