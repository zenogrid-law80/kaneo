import { z } from "../openapi";

export const milestoneParam = z.object({ id: z.string().min(1) });
export const milestoneProjectParam = z.object({ projectId: z.string().min(1) });
export const milestoneDate = z.iso.date();
const fields = {
  name: z.string().trim().min(1).max(200),
  description: z.string().max(10_000).nullable(),
  dueDate: milestoneDate.nullable(),
};
export const createMilestoneBody = z.object({
  name: fields.name,
  description: fields.description.optional(),
  dueDate: fields.dueDate.optional(),
});
export const updateMilestoneBody = z
  .object({
    name: fields.name.optional(),
    description: fields.description.optional(),
    dueDate: fields.dueDate.optional(),
    status: z.enum(["open", "closed"]).optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one field",
  );
const page = z.coerce.number().int().min(1).max(1_000_000).default(1);
const limit = z.coerce.number().int().min(1).max(100).default(50);
export const listMilestonesQuery = z.object({
  status: z.enum(["open", "closed"]).optional(),
  page,
  limit,
});
export const milestoneTasksQuery = z.object({
  archived: z.enum(["true", "false"]).default("false"),
  page,
  limit,
});
export const updateTaskMilestoneBody = z.object({
  milestoneId: z.string().min(1).nullable(),
});
