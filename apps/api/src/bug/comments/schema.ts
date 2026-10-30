import { z } from "../../openapi";
import { bugParam } from "../schema";

export const bugCommentParam = bugParam.extend({
  commentId: z.string().min(1),
});
export const bugCommentBody = z.strictObject({
  content: z.string().trim().min(1).max(10000),
});
export const bugCommentsQuery = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
