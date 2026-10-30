import type { BugFilters } from "@/fetchers/bug";

export type BugSearch = BugFilters & {
  bugId?: string;
  view?: "cards" | "list";
};

export function parseBugSearch(search: Record<string, unknown>): BugSearch {
  const result: BugSearch = { view: search.view === "list" ? "list" : "cards" };
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
