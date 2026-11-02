import type { BugMetadata, BugFilters } from "@/fetchers/bug";

export const bugPriorityKeys = {
  "no-priority": "tasks:priority.no-priority",
  low: "tasks:priority.low",
  medium: "tasks:priority.medium",
  high: "tasks:priority.high",
  urgent: "tasks:priority.urgent",
} as const satisfies Record<BugMetadata["priority"], string>;
export const bugSeverityKeys = {
  "no-severity": "tasks:bugs.severities.none",
  trivial: "tasks:bugs.severities.trivial",
  minor: "tasks:bugs.severities.minor",
  major: "tasks:bugs.severities.major",
  critical: "tasks:bugs.severities.critical",
} as const satisfies Record<BugMetadata["severity"], string>;
export const bugEnvironmentKeys = {
  none: "tasks:bugs.environments.none",
  development: "tasks:bugs.environments.development",
  staging: "tasks:bugs.environments.staging",
  production: "tasks:bugs.environments.production",
} as const satisfies Record<
  NonNullable<BugMetadata["environment"]> | "none",
  string
>;
export const bugMetadataFields = [
  { key: "priority", label: "tasks:priority.label", values: bugPriorityKeys },
  { key: "severity", label: "tasks:bugs.severity", values: bugSeverityKeys },
  {
    key: "environment",
    label: "tasks:bugs.environment",
    values: bugEnvironmentKeys,
  },
] as const;
export const bugSortKeys = {
  createdAt: "tasks:sort.fields.createdAt",
  updatedAt: "tasks:bugs.updatedAt",
  title: "tasks:sort.fields.title",
  priority: "tasks:priority.label",
  severity: "tasks:bugs.severity",
  environment: "tasks:bugs.environment",
} as const satisfies Record<NonNullable<BugFilters["sortBy"]>, string>;
