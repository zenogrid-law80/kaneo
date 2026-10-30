import { useTranslation } from "react-i18next";
import type { BugHistoryEntry, BugStatus } from "@/fetchers/bug";
import { bugStatusKeys } from "./bug-status";

const fieldLabels = {
  title: "tasks:bugs.issueTitle",
  description: "tasks:bugs.description",
  status: "tasks:bugs.status",
  reporterId: "tasks:bugs.reporter",
  fixerId: "tasks:bugs.fixer",
  verifierId: "tasks:bugs.verifier",
  milestoneId: "tasks:milestones.title",
} as const;

export default function BugHistoryChange({
  change,
}: {
  change: BugHistoryEntry["changes"][number];
}) {
  const { t } = useTranslation();
  const value = (side: "before" | "after") => {
    const raw = change[side];
    if (raw === null || raw === "") return t("tasks:bugs.historyEmptyValue");
    if (change.field === "status")
      return t(bugStatusKeys[raw as BugStatus] ?? "tasks:bugs.status");
    return change[`${side}Label`] ?? raw;
  };
  if (change.field === "description")
    return (
      <details className="mt-2 rounded-md border p-2">
        <summary className="cursor-pointer text-sm">
          {t("tasks:bugs.historyDescriptionChanged")}
        </summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {(["before", "after"] as const).map((side) => (
            <div key={side}>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                {t(
                  side === "before"
                    ? "tasks:bugs.historyBefore"
                    : "tasks:bugs.historyAfter",
                )}
              </p>
              <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-2 text-xs">
                {value(side)}
              </pre>
            </div>
          ))}
        </div>
      </details>
    );
  return (
    <p className="break-words text-sm">
      <span className="font-medium">{t(fieldLabels[change.field])}: </span>
      {value("before")} → {value("after")}
    </p>
  );
}
