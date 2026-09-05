import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarDays,
  CalendarRange,
  Network,
  SquareKanban,
  SquircleDashed,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import MobileProjectNav from "@/components/common/header/mobile-project-nav";
import ProjectCrumbSelect from "@/components/common/header/project-crumb-select";
import WorkspaceCrumbSelect from "@/components/common/header/workspace-crumb-select";
import Layout from "@/components/common/layout";
import CreateProjectModal from "@/components/shared/modals/create-project-modal";
import { Button } from "@/components/ui/button";
import { KbdSequence } from "@/components/ui/kbd";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { shortcuts } from "@/constants/shortcuts";
import useGetProject from "@/hooks/queries/project/use-get-project";
import { useProjectWebSocket } from "@/hooks/use-project-websocket";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";

type ProjectLayoutProps = {
  projectId: string;
  workspaceId: string;
  headerActions?: ReactNode;
  children: ReactNode;
  showViewSwitcher?: boolean;
  activeView?:
    | "backlog"
    | "board"
    | "calendar"
    | "gantt"
    | "hierarchy"
    | "statistics";
};

export default function ProjectLayout({
  projectId,
  workspaceId,
  headerActions,
  children,
  showViewSwitcher = true,
  activeView,
}: ProjectLayoutProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: project } = useGetProject({ id: projectId, workspaceId });
  const { canManageWorkspace } = useWorkspacePermission();
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] =
    useState(false);

  useProjectWebSocket(projectId);

  const resolvedView =
    activeView ??
    (location.pathname.includes("/backlog")
      ? "backlog"
      : location.pathname.includes("/calendar")
        ? "calendar"
        : location.pathname.includes("/hierarchy")
          ? "hierarchy"
          : location.pathname.includes("/gantt")
            ? "gantt"
            : location.pathname.includes("/statistics")
              ? "statistics"
              : "board");

  const handleNavigateToBacklog = () => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/backlog",
      params: { workspaceId, projectId },
    });
  };

  const handleNavigateToBoard = () => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
      params: { workspaceId, projectId },
    });
  };

  const handleNavigateToCalendar = () => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/calendar",
      params: { workspaceId, projectId },
    });
  };

  const handleNavigateToGantt = () => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/gantt",
      params: { workspaceId, projectId },
    });
  };

  const handleNavigateToHierarchy = () => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/hierarchy",
      params: { workspaceId, projectId },
    });
  };

  const handleNavigateToStatistics = () => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/statistics",
      params: { workspaceId, projectId },
    });
  };

  const handleProjectSwitch = (nextProjectId: string) => {
    navigate({
      to:
        resolvedView === "backlog"
          ? "/dashboard/workspace/$workspaceId/project/$projectId/backlog"
          : resolvedView === "calendar"
            ? "/dashboard/workspace/$workspaceId/project/$projectId/calendar"
            : resolvedView === "gantt"
              ? "/dashboard/workspace/$workspaceId/project/$projectId/gantt"
              : resolvedView === "statistics"
                ? "/dashboard/workspace/$workspaceId/project/$projectId/statistics"
                : resolvedView === "hierarchy"
                  ? "/dashboard/workspace/$workspaceId/project/$projectId/hierarchy"
                  : "/dashboard/workspace/$workspaceId/project/$projectId/board",
      params: {
        workspaceId,
        projectId: nextProjectId,
      },
    });
  };

  return (
    <Layout>
      <Layout.Header className="h-auto flex-col gap-0 border-border/80 p-0 transition-none group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-auto">
        <div className="flex min-h-12 w-full items-center justify-between gap-2 px-3">
          <div className="flex min-w-0 items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarTrigger className="-ml-1 h-7 w-7 cursor-pointer text-foreground/85 hover:text-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="flex items-center gap-2 text-[10px]">
                    {t("common:a11y.toggleSidebar")}
                    <KbdSequence
                      keys={[
                        shortcuts.sidebar.prefix,
                        shortcuts.sidebar.toggle,
                      ]}
                    />
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="h-4 w-px shrink-0 bg-border/80" />

            <div className="hidden min-w-0 items-center gap-1 md:flex">
              <WorkspaceCrumbSelect />
              <span className="text-foreground/30 text-xs">/</span>
              <ProjectCrumbSelect
                workspaceId={workspaceId}
                projectId={projectId}
                projectName={project?.name}
                onSelectProject={handleProjectSwitch}
                onAddProject={() => setIsCreateProjectModalOpen(true)}
              />
            </div>

            <div className="md:hidden">
              <MobileProjectNav
                workspaceId={workspaceId}
                projectId={projectId}
                activeView={resolvedView}
                onSelectBacklog={handleNavigateToBacklog}
                onSelectBoard={handleNavigateToBoard}
                onSelectCalendar={handleNavigateToCalendar}
                onSelectGantt={handleNavigateToGantt}
                onSelectStatistics={
                  canManageWorkspace() ? handleNavigateToStatistics : undefined
                }
                onSelectHierarchy={handleNavigateToHierarchy}
                onSelectProject={handleProjectSwitch}
                onAddProject={() => setIsCreateProjectModalOpen(true)}
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {headerActions}
          </div>
        </div>
        {showViewSwitcher && (
          <div className="hidden min-w-0 items-center gap-1 overflow-x-auto border-t border-border/60 bg-muted/20 px-3 py-2 md:flex">
            <Button
              variant={resolvedView === "backlog" ? "secondary" : "ghost"}
              size="xs"
              aria-current={resolvedView === "backlog" ? "page" : undefined}
              onClick={handleNavigateToBacklog}
              className={cn(
                "h-8 shrink-0 gap-1.5 rounded-md px-3 text-xs",
                resolvedView !== "backlog" && "text-muted-foreground",
              )}
            >
              <SquircleDashed className="size-3.5" />
              {t("tasks:view.backlog")}
            </Button>
            <Button
              variant={resolvedView === "board" ? "secondary" : "ghost"}
              size="xs"
              aria-current={resolvedView === "board" ? "page" : undefined}
              onClick={handleNavigateToBoard}
              className={cn(
                "h-8 shrink-0 gap-1.5 rounded-md px-3 text-xs",
                resolvedView !== "board" && "text-muted-foreground",
              )}
            >
              <SquareKanban className="size-3.5" />
              {t("tasks:view.board")}
            </Button>
            <Button
              variant={resolvedView === "hierarchy" ? "secondary" : "ghost"}
              size="xs"
              aria-current={resolvedView === "hierarchy" ? "page" : undefined}
              onClick={handleNavigateToHierarchy}
              className={cn(
                "h-8 shrink-0 gap-1.5 rounded-md px-3 text-xs",
                resolvedView !== "hierarchy" && "text-muted-foreground",
              )}
            >
              <Network className="size-3.5" />
              {t("tasks:hierarchy.title")}
            </Button>
            <Button
              variant={resolvedView === "calendar" ? "secondary" : "ghost"}
              size="xs"
              aria-current={resolvedView === "calendar" ? "page" : undefined}
              onClick={handleNavigateToCalendar}
              className={cn(
                "h-8 shrink-0 gap-1.5 rounded-md px-3 text-xs",
                resolvedView !== "calendar" && "text-muted-foreground",
              )}
            >
              <CalendarRange className="size-3.5" />
              {t("tasks:calendar.title")}
            </Button>
            <Button
              variant={resolvedView === "gantt" ? "secondary" : "ghost"}
              size="xs"
              aria-current={resolvedView === "gantt" ? "page" : undefined}
              onClick={handleNavigateToGantt}
              className={cn(
                "h-8 shrink-0 gap-1.5 rounded-md px-3 text-xs",
                resolvedView !== "gantt" && "text-muted-foreground",
              )}
            >
              <CalendarDays className="size-3.5" />
              {t("tasks:view.gantt")}
            </Button>
            {canManageWorkspace() && (
              <Button
                variant={resolvedView === "statistics" ? "secondary" : "ghost"}
                size="xs"
                aria-current={
                  resolvedView === "statistics" ? "page" : undefined
                }
                onClick={handleNavigateToStatistics}
                className={cn(
                  "h-8 shrink-0 gap-1.5 rounded-md px-3 text-xs",
                  resolvedView !== "statistics" && "text-muted-foreground",
                )}
              >
                <BarChart3 className="size-3.5" />
                {t("statistics:pageTitle")}
              </Button>
            )}
          </div>
        )}
      </Layout.Header>

      <Layout.Content>{children}</Layout.Content>

      <CreateProjectModal
        open={isCreateProjectModalOpen}
        onClose={() => setIsCreateProjectModalOpen(false)}
      />
    </Layout>
  );
}
