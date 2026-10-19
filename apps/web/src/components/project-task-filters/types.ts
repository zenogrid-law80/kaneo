import type { DUE_DATE_FILTER_VALUES } from "@/hooks/use-task-filters";

export type DueDateFilter =
  | "all"
  | (typeof DUE_DATE_FILTER_VALUES)[keyof typeof DUE_DATE_FILTER_VALUES];
