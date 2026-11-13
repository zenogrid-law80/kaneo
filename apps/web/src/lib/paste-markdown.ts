import type { Editor } from "@tiptap/core";

export function pasteMarkdown(editor: Editor, event: ClipboardEvent): boolean {
  const clipboard = event.clipboardData;
  // Rich clipboard content and code retain their native paste behavior.
  if (
    !editor.isEditable ||
    !clipboard ||
    clipboard.getData("text/html") ||
    editor.isActive("codeBlock") ||
    editor.isActive("code")
  ) {
    return false;
  }
  const text = clipboard.getData("text/plain");
  if (!text || !editor.markdown) return false;
  // Leave single URLs to the issue-link and video-embed paste handlers.
  if (/^https?:\/\/\S+$/i.test(text.trim())) return false;
  let document: ReturnType<typeof editor.markdown.parse>;
  try {
    document = editor.markdown.parse(text);
  } catch {
    return false;
  }
  const soleParagraph =
    document.content?.length === 1 && document.content[0].type === "paragraph"
      ? document.content[0]
      : undefined;
  const soleInline =
    soleParagraph?.content?.length === 1 ? soleParagraph.content[0] : undefined;
  // GFM autolinks such as www.youtube.com must reach specialized URL handlers.
  if (
    soleInline?.text === text.trim() &&
    soleInline.marks?.some((mark) => mark.type === "link")
  )
    return false;
  const hasFormatting = (nodes: typeof document.content): boolean =>
    (nodes ?? []).some(
      (node) =>
        (node.type !== "paragraph" && node.type !== "text") ||
        Boolean(node.marks?.length) ||
        hasFormatting(node.content),
    );
  if (!hasFormatting(document.content)) return false;
  try {
    if (
      !editor.commands.insertContent(
        soleParagraph?.content ?? document.content ?? [],
      )
    )
      return false;
  } catch {
    // Let the editor's normal paste path handle invalid Markdown content.
    return false;
  }
  event.preventDefault();
  return true;
}
