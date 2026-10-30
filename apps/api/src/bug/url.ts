export function buildBugUrl(
  workspaceId: string,
  projectId: string,
  bugId: string,
) {
  const clientUrl = (
    process.env.KANEO_CLIENT_URL || "http://localhost:5173"
  ).replace(/\/+$/, "");
  return `${clientUrl}/dashboard/workspace/${encodeURIComponent(workspaceId)}/project/${encodeURIComponent(projectId)}/bugs?bugId=${encodeURIComponent(bugId)}`;
}
