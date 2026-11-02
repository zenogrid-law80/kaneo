import type { BugFilters } from "@/fetchers/bug";
import { bugMetadataFields, bugSortKeys } from "./bug-metadata";

export type BugSearch = BugFilters & {
  bugId?: string;
  view?: "cards" | "list";
};

export function parseBugSearch(search: Record<string, unknown>): BugSearch {
  const result: BugSearch = { view: search.view === "list" ? "list" : "cards" };
  for (const { key, values } of bugMetadataFields) {
    const raw = search[key];
    if (typeof raw !== "string") continue;
    const selected = [
      ...new Set(
        raw
          .split(",")
          .map((value) => value.trim())
          .filter((value) => Object.hasOwn(values, value)),
      ),
    ];
    if (selected.length) result[key] = selected.join(",");
  }
  if (typeof search.search === "string" && search.search.trim())
    result.search = search.search.trim().slice(0, 200);
  if (
    typeof search.sortBy === "string" &&
    Object.hasOwn(bugSortKeys, search.sortBy)
  )
    result.sortBy = search.sortBy as BugSearch["sortBy"];
  if (search.sortOrder === "asc" || search.sortOrder === "desc")
    result.sortOrder = search.sortOrder;
  for (const key of [
    "bugId",
    "reporterId",
    "fixerId",
    "verifierId",
    "milestoneId",
  ] as const) {
    const value = search[key];
    if (typeof value !== "string" || !value.trim()) continue;
    if (key === "reporterId" || key === "fixerId" || key === "verifierId") {
      const ids = [
        ...new Set(
          value
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean),
        ),
      ];
      if (ids.length > 0) result[key] = ids.join(",");
    } else result[key] = value;
  }
  return result;
}
