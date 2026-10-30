import type { BugStatus } from "@/fetchers/bug";
export const bugStatuses = [
  "new",
  "in-progress",
  "resolved",
] as const satisfies readonly BugStatus[];
export const bugStatusKeys = {
  new: "tasks:bugs.new",
  "in-progress": "tasks:bugs.inProgress",
  resolved: "tasks:bugs.resolved",
} as const;
