import { Network } from "lucide-react";
import { useTranslation } from "react-i18next";
import { buildTaskHierarchy } from "@/lib/build-task-hierarchy";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import HierarchyRow from "./hierarchy-row";

type HierarchyViewProps = {
  project: ProjectWithTasks;
  tasks?: Task[];
  onOpenTask: (taskId: string) => void;
};

export default function HierarchyView({
  project,
  tasks: visibleTasks,
  onOpenTask,
}: HierarchyViewProps) {
  const { t } = useTranslation();
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(
    project.workspaceId,
  );
  const tasks = visibleTasks ?? [
    ...project.plannedTasks,
    ...project.columns.flatMap((column) => column.tasks),
  ];
  const roots = buildTaskHierarchy(tasks, project.subtaskRelations ?? []);

  if (roots.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
          <Network className="size-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">{t("tasks:hierarchy.empty")}</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {t("tasks:hierarchy.emptyDescription")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-background p-3 sm:p-4">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-lg border border-border bg-card">
        {roots.map((root) => (
          <HierarchyRow
            key={root.task.id}
            node={root}
            depth={0}
            project={project}
            onOpenTask={onOpenTask}
            members={workspaceUsers?.members}
          />
        ))}
      </div>
    </div>
  );
}
