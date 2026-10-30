import { Bug } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export default function MilestoneBugLink({
  workspaceId,
  projectId,
  milestoneId,
}: {
  workspaceId: string;
  projectId: string;
  milestoneId: string;
}) {
  const { t } = useTranslation();
  const href = `/dashboard/workspace/${encodeURIComponent(workspaceId)}/project/${encodeURIComponent(projectId)}/bugs?view=list&milestoneId=${encodeURIComponent(milestoneId)}`;
  return (
    <Button variant="outline" size="sm" render={<a href={href} />}>
      <Bug className="size-4" />
      {t("tasks:bugs.milestoneBugs")}
    </Button>
  );
}
