import { useNavigate } from "@tanstack/react-router";
import { Bug, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import BugBoard from "./bug-board";
import BugList from "./bug-list";
import BugFilters from "./bug-filters";
import type { BugSearch } from "./bug-search";
import BugDetail from "@/components/bug/bug-detail";
import BugForm from "@/components/bug/bug-form";
import { useBugTemplate } from "@/hooks/queries/bug/use-bugs";
import { useBugMutations } from "@/hooks/mutations/bug/use-bug-mutations";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export default function ProjectBugs({
  projectId,
  workspaceId,
  search,
}: {
  projectId: string;
  workspaceId: string;
  search: BugSearch;
}) {
  const { t } = useTranslation();
  const { bugId, reporterId, fixerId, verifierId, milestoneId } = search;
  const filters = { reporterId, fixerId, verifierId, milestoneId };
  const filterKey = JSON.stringify(filters);
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const template = useBugTemplate(projectId);
  const mutations = useBugMutations(projectId);
  const { canCreateTasks, canAssignTasks, canUpdateTasks } =
    useWorkspacePermission();
  const changeSearch = (patch: Partial<BugSearch>) =>
    void navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/bugs",
      params: { projectId, workspaceId },
      search: { ...search, ...patch },
    });
  const select = (bugId?: string) => changeSearch({ bugId });
  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="bugs"
    >
      <PageTitle title={t("tasks:bugs.title")} />
      <div className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              <Bug className="size-5" />
              {t("tasks:bugs.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("tasks:bugs.subtitle")}
            </p>
          </div>
          {canCreateTasks() && (
            <Button
              size="sm"
              disabled={!template.data || template.isError}
              onClick={() => setCreating(true)}
            >
              <Plus className="size-4" />
              {t("tasks:bugs.create")}
            </Button>
          )}
        </div>
        {template.isError && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 text-sm"
          >
            <p>{t("tasks:bugs.templateLoadError")}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void template.refetch()}
            >
              {t("tasks:bugs.retry")}
            </Button>
          </div>
        )}
        <BugFilters
          workspaceId={workspaceId}
          projectId={projectId}
          search={search}
          onChange={(patch) => changeSearch({ ...patch, bugId: undefined })}
        />
        {search.view === "list" ? (
          <BugList
            key={filterKey}
            projectId={projectId}
            filters={filters}
            onSelect={select}
          />
        ) : (
          <BugBoard
            key={filterKey}
            projectId={projectId}
            filters={filters}
            canMove={canUpdateTasks()}
            onSelect={select}
          />
        )}
      </div>
      {creating && template.data && canCreateTasks() && (
        <BugForm
          projectId={projectId}
          workspaceId={workspaceId}
          canAssign={canAssignTasks()}
          template={template.data.template}
          onClose={() => setCreating(false)}
          onSave={({
            title,
            description,
            reporterId,
            fixerId,
            verifierId,
            milestoneId,
          }) =>
            mutations.create.mutateAsync({
              title,
              description,
              reporterId,
              milestoneId,
              fixerId,
              verifierId,
            })
          }
        />
      )}
      {bugId && (
        <BugDetail
          workspaceId={workspaceId}
          key={bugId}
          projectId={projectId}
          id={bugId}
          onClose={() => select()}
        />
      )}
    </ProjectLayout>
  );
}
