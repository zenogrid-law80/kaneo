import { useNavigate } from "@tanstack/react-router";
import { Flag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMilestoneOptions } from "@/hooks/queries/milestone/use-milestones";

export default function MilestoneBadge({
  id,
  projectId,
  workspaceId,
}: {
  id: string;
  projectId: string;
  workspaceId: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const query = useMilestoneOptions(projectId);
  const milestone = query.data?.pages
    .flatMap((page) => page.data)
    .find((m) => m.id === id);
  return (
    <button
      type="button"
      className="inline-flex max-w-40 items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        void navigate({
          to: "/dashboard/workspace/$workspaceId/project/$projectId/milestones",
          params: { workspaceId, projectId },
          search: { milestoneId: id },
        });
      }}
    >
      <Flag className="size-3 shrink-0" />
      <span className="truncate">
        {milestone?.name ?? t("tasks:milestones.title")}
      </span>
    </button>
  );
}
