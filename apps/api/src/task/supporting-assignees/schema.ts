import { z } from "../../openapi";

export const supportingAssigneeParam = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
});

export const supportingAssigneesSchema = z
  .array(
    z.object({
      userId: z.string(),
      name: z.string(),
      image: z.string().nullable(),
    }),
  )
  .openapi("TaskSupportingAssignees");
