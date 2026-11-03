import type { Editor, JSONContent } from "@tiptap/core";
import { normalizeCommentMarkdown } from "@/lib/normalize-comment-markdown";

// TipTap's Markdown parser omits the required paragraph in empty list items.
function repairEmptyBlocks(node: JSONContent): JSONContent {
  const content = node.content?.map(repairEmptyBlocks);
  if (node.type === "listItem" && !content?.length) {
    return { ...node, content: [{ type: "paragraph" }] };
  }
  if (
    node.type === "paragraph" &&
    content?.length === 1 &&
    content[0].type === "text" &&
    (content[0].text === "\u00a0" || content[0].text === "&nbsp;")
  ) {
    return { ...node, content: [] };
  }
  return content ? { ...node, content } : node;
}

// Consecutive blank lines in a template describe empty writing space. Markdown
// normally collapses them, so encode the extra lines as empty paragraphs.
function prepareMarkdown(markdown: string, template: boolean): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const output: string[] = [];
  let fence: { marker: string; length: number } | undefined;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      output.push(line);
      if (
        match &&
        match[1][0] === fence.marker &&
        match[1].length >= fence.length &&
        /^ {0,3}(?:`+|~+)\s*$/.test(line)
      )
        fence = undefined;
      continue;
    }
    if (match) {
      fence = { marker: match[1][0], length: match[1].length };
      output.push(line);
      continue;
    }
    if (!line.trim()) {
      let end = i + 1;
      while (end < lines.length && !lines[end].trim()) end++;
      const count = end - i;
      if (
        /^(?: {4}|\t)/.test(lines[i - 1] ?? "") ||
        /^(?: {4}|\t)/.test(lines[end] ?? "")
      ) {
        output.push(...lines.slice(i, end));
        i = end - 1;
        continue;
      }
      output.push("");
      const heading = /^ {0,3}#{1,3}(?:\s|$)/;
      const preserveSeparator =
        template &&
        (heading.test(lines[i - 1] ?? "") || heading.test(lines[end] ?? ""));
      for (let n = preserveSeparator ? 0 : 1; n < count; n++)
        output.push("&nbsp;", "");
      i = end - 1;
      continue;
    }
    output.push(line);
  }
  return output.join("\n");
}

export function prepareBugMarkdown(markdown: string): string {
  return prepareMarkdown(markdown, false);
}

export function prepareBugTemplate(markdown: string): string {
  return prepareMarkdown(markdown, true);
}

export function parseBugMarkdown(
  editor: Editor,
  markdown: string,
): JSONContent {
  return repairEmptyBlocks(
    editor.storage.markdown.manager.parse(prepareBugMarkdown(markdown)),
  );
}

export function serializeBugMarkdown(editor: Editor): string {
  // Use a unique temporary text value so the normalizer does not remove the
  // empty-paragraph marker. The value never enters the editor document.
  const document = editor.getJSON();
  const source = JSON.stringify(document);
  let marker = "KANEOEMPTYBLOCKMARKER";
  let breakMarker = "KANEOLINEBREAKMARKER";
  while (source.includes(marker)) marker += "X";
  while (source.includes(breakMarker)) breakMarker += "X";
  const markEmpty = (node: JSONContent): JSONContent => {
    if (node.type === "hardBreak") {
      return { type: "text", text: breakMarker, marks: node.marks };
    }
    if (node.type === "paragraph" && !node.content?.length) {
      return { ...node, content: [{ type: "text", text: marker }] };
    }
    return node.content
      ? { ...node, content: node.content.map(markEmpty) }
      : node;
  };
  const markdown = editor.storage.markdown.manager.serialize(
    markEmpty(document),
  );
  return normalizeCommentMarkdown(markdown)
    .replaceAll(marker, "&nbsp;")
    .replaceAll(breakMarker, "<br>");
}
