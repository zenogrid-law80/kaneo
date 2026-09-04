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
