import { ChevronRight, GitFork } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import TaskAssigneeAvatars from "@/components/task/task-assignee-avatars";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { TaskHierarchyNode } from "@/lib/build-task-hierarchy";
import { cn } from "@/lib/cn";
import type { ProjectWithTasks } from "@/types/project";

export default function HierarchyRow({
  node,
  depth,
  project,
  onOpenTask,
  members,
}: {
  node: TaskHierarchyNode;
  depth: number;
  project: ProjectWithTasks;
  onOpenTask: (taskId: string) => void;
  members?: Array<{
    userId: string;
    user: { name?: string | null; image?: string | null };
  }>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  const column = project.columns.find((item) => item.slug === node.task.status);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className="group flex min-h-10 items-center border-b border-border/60 hover:bg-accent/45"
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
      >
        {hasChildren ? (
          <CollapsibleTrigger
            aria-label={
              open
                ? t("tasks:hierarchy.collapseTask", { title: node.task.title })
                : t("tasks:hierarchy.expandTask", { title: node.task.title })
            }
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ChevronRight
              className={cn("size-4 transition-transform", open && "rotate-90")}
            />
          </CollapsibleTrigger>
        ) : (
          <span className="flex size-7 shrink-0 items-center justify-center text-border">
            <span className="size-1 rounded-full bg-current" />
          </span>
        )}

        <button
          type="button"
          onClick={() => onOpenTask(node.task.id)}
          className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left"
        >
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
            {project.slug}-{node.task.number}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">
            {node.task.title}
          </span>
          {hasChildren && (
            <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <GitFork className="size-3.5" />
              {node.children.length}
            </span>
          )}
          <span className="hidden shrink-0 rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground sm:inline">
            {column?.name ?? node.task.status}
          </span>
        </button>
        <TaskAssigneeAvatars
          task={node.task}
          members={members}
          supportingDisplay="count"
          className="ml-3 mr-4"
        />
      </div>

      {hasChildren && (
        <CollapsiblePanel>
          {node.children.map((child) => (
            <HierarchyRow
              key={`${node.task.id}-${child.task.id}`}
              node={child}
              depth={depth + 1}
              project={project}
              onOpenTask={onOpenTask}
              members={members}
            />
          ))}
        </CollapsiblePanel>
      )}
    </Collapsible>
  );
}
