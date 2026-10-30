import { Flag } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { BugSummary } from "@/fetchers/bug";

export default function BugCardContent({ bug }: { bug: BugSummary }) {
  const { t } = useTranslation();
  return (
    <div className="p-4 text-left text-sm">
      <span className="line-clamp-3 break-words pr-5 font-medium">
        {bug.title}
      </span>
      {bug.milestone && (
        <span className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Flag className="size-3 shrink-0" />
          <span className="truncate">{bug.milestone.name}</span>
        </span>
      )}
      <span className="mt-3 block space-y-1 text-xs text-muted-foreground">
        <span className="block truncate">
          {t("tasks:bugs.reporter")}:{" "}
          {bug.reporter?.name ?? t("tasks:bugs.unrecorded")}
        </span>
        <span className="block truncate">
          {t("tasks:bugs.fixer")}:{" "}
          {bug.fixer?.name ?? t("tasks:bugs.unassigned")}
        </span>
        <span className="block truncate">
          {t("tasks:bugs.verifier")}:{" "}
          {bug.verifier?.name ?? t("tasks:bugs.unassigned")}
        </span>
      </span>
    </div>
  );
}
