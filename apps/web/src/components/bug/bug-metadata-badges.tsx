import { useTranslation } from "react-i18next";
import type { BugMetadata } from "@/fetchers/bug";
import {
  bugPriorityKeys,
  bugSeverityKeys,
  bugEnvironmentKeys,
} from "./bug-metadata";

export default function BugMetadataBadges({ bug }: { bug: BugMetadata }) {
  const { t } = useTranslation();
  const items = [
    ...(bug.priority !== "no-priority"
      ? [
          {
            label: t("tasks:priority.label"),
            value: t(bugPriorityKeys[bug.priority]),
          },
        ]
      : []),
    ...(bug.severity !== "no-severity"
      ? [
          {
            label: t("tasks:bugs.severity"),
            value: t(bugSeverityKeys[bug.severity]),
          },
        ]
      : []),
    ...(bug.environment
      ? [
          {
            label: t("tasks:bugs.environment"),
            value: t(bugEnvironmentKeys[bug.environment]),
          },
        ]
      : []),
  ];
  if (!items.length) return null;
  return (
    <span className="mt-2 flex flex-wrap gap-1">
      {items.map((item) => (
        <span
          key={item.label}
          className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
          aria-label={`${item.label}: ${item.value}`}
        >
          {item.value}
        </span>
      ))}
    </span>
  );
}
