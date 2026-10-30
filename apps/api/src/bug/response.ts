import { responseTimestamp, z } from "../openapi";
import { bugHistoryFields } from "./history-types";
import { bugStatus } from "./schema";

const bugPerson = z
  .object({
    id: z.string(),
    name: z.string(),
    image: z.string().nullable(),
  })
  .nullable();

export const bugSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    title: z.string(),
    description: z.string(),
    status: bugStatus,
    reporterId: z.string().nullable().openapi({
      description:
        "Defaults to the creator and can be reassigned. Null when unassigned, for older reports or deleted accounts.",
    }),
    fixerId: z.string().nullable(),
    verifierId: z.string().nullable(),
    reporter: bugPerson,
    fixer: bugPerson,
    verifier: bugPerson,
    milestoneId: z.string().nullable(),
    milestone: z
      .object({
        id: z.string(),
        name: z.string(),
        status: z.enum(["open", "closed"]),
      })
      .nullable(),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("Bug");
export const bugListSchema = z
  .object({
    data: z.array(bugSchema.omit({ description: true })),
    pagination: z.object({
      total: z.number(),
      page: z.number(),
      pageSize: z.number(),
      totalPages: z.number(),
    }),
  })
  .openapi("BugListResponse");
export const bugTemplateSchema = z
  .object({ template: z.string(), isDefault: z.boolean() })
  .openapi("BugTemplate");
export const deleteBugSchema = z.object({ success: z.boolean() });

export const bugHistorySchema = z
  .object({
    data: z.array(
      z.object({
        id: z.string(),
        bugId: z.string(),
        userId: z.string().nullable(),
        user: bugPerson,
        type: z.enum(["created", "updated"]),
        createdAt: responseTimestamp,
        changes: z.array(
          z.object({
            field: z.enum(bugHistoryFields),
            before: z.string().nullable(),
            after: z.string().nullable(),
            beforeLabel: z.string().nullable().optional(),
            afterLabel: z.string().nullable().optional(),
          }),
        ),
      }),
    ),
    pagination: z.object({
      page: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }),
  })
  .openapi("BugHistory");
