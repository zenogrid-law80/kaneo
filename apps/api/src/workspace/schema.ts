import { z } from "../openapi";

export const workspaceIdParam = z.object({ workspaceId: z.string() });

export const statisticsQuery = z.object({
  projectId: z.string().optional().openapi({
    description: "Limit statistics to one project in the workspace.",
  }),
  startDate: z.iso.date().optional().openapi({
    description: "Include statistics on or after this date (YYYY-MM-DD).",
  }),
  endDate: z.iso.date().optional().openapi({
    description: "Include statistics on or before this date (YYYY-MM-DD).",
  }),
});

export const myTasksQuery = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    due: z.enum(["all", "overdue", "today", "undated"]).default("all"),
    dayStart: z.iso.datetime({ offset: true }).optional(),
    dayEnd: z.iso.datetime({ offset: true }).optional(),
  })
  .refine(
    (query) => {
      if (query.due !== "overdue" && query.due !== "today") return true;
      if (!query.dayStart || !query.dayEnd) return false;
      const duration = Date.parse(query.dayEnd) - Date.parse(query.dayStart);
      return duration > 0 && duration <= 26 * 60 * 60 * 1000;
    },
    { message: "Date filters require valid local day boundaries" },
  );
