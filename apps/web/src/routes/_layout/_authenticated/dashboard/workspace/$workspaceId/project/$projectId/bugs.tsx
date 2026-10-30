import { createFileRoute } from "@tanstack/react-router";
import ProjectBugs from "@/components/bug/project-bugs";
import { parseBugSearch } from "@/components/bug/bug-search";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/bugs",
)({
  component: BugsPage,
  validateSearch: parseBugSearch,
});
function BugsPage() {
  const { projectId, workspaceId } = Route.useParams();
  const search = Route.useSearch();
  // Route parameter changes must not retain a draft from another project.
  return (
    <ProjectBugs
      key={projectId}
      projectId={projectId}
      workspaceId={workspaceId}
      search={search}
    />
  );
}
