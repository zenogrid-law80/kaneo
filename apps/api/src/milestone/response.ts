import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";
import { taskSchema } from "../task/response";
import { milestoneDate } from "./schema";

export const milestoneSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    dueDate: milestoneDate.nullable(),
    status: z.enum(["open", "closed"]),
    isCurrent: z.boolean(),
    closedAt: nullableResponseTimestamp,
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("Milestone");
export const currentMilestoneSchema = z
  .union([milestoneSchema, z.null()])
  .openapi("CurrentMilestoneResponse");
export const milestoneWithStatisticsSchema = milestoneSchema
  .extend({
    totalTasks: z.number().int(),
    completedTasks: z.number().int(),
    archivedTasks: z.number().int(),
    progressPercent: z.number(),
  })
  .openapi("MilestoneWithStatistics");
export const milestonePaginationSchema = z
  .object({
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
    totalPages: z.number(),
  })
  .openapi("MilestonePagination");
export const milestoneListSchema = z
  .object({
    data: z.array(milestoneWithStatisticsSchema),
    pagination: milestonePaginationSchema,
  })
  .openapi("MilestoneListResponse");
export const milestoneTaskListSchema = z
  .object({ data: z.array(taskSchema), pagination: milestonePaginationSchema })
  .openapi("MilestoneTaskListResponse");
export const deleteMilestoneSchema = z
  .object({ success: z.boolean(), detachedTasks: z.number() })
  .openapi("DeleteMilestoneResult");
