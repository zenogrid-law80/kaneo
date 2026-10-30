import { responseTimestamp, z } from "../../openapi";

export const bugCommentSchema = z
  .object({
    id: z.string(),
    bugId: z.string(),
    userId: z.string().nullable(),
    content: z.string(),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
    user: z
      .object({
        id: z.string(),
        name: z.string(),
        image: z.string().nullable(),
      })
      .nullable(),
  })
  .openapi("BugComment");

export const bugCommentsSchema = z
  .object({
    data: z.array(bugCommentSchema),
    pagination: z.object({
      page: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }),
  })
  .openapi("BugComments");
