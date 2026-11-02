export const bugPriorities = [
  "no-priority",
  "low",
  "medium",
  "high",
  "urgent",
] as const;
export const bugSeverities = [
  "no-severity",
  "trivial",
  "minor",
  "major",
  "critical",
] as const;
export const bugEnvironments = [
  "development",
  "staging",
  "production",
] as const;
export const bugSortFields = [
  "createdAt",
  "updatedAt",
  "title",
  "priority",
  "severity",
  "environment",
] as const;
