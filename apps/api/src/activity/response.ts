import { responseTimestamp, z } from "../openapi";

const activityTypeDescription =
  "One of: comment, task, create, status_changed, priority_changed, assignee_changed, supporting_assignee_added, supporting_assignee_removed, unassigned, due_date_changed, title_changed, description_changed.";

export const activitySchema = z
  .object({
    id: z.string(),
    taskId: z.string(),
    type: z.string().openapi({ description: activityTypeDescription }),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
    userId: z.string().nullable(),
    content: z.string().nullable(),
    eventData: z.unknown().openapi({
      description:
        "Type-specific payload, e.g. { oldStatus, newStatus } for status_changed. Null for plain comments.",
    }),
    externalUserName: z.string().nullable().openapi({
      description: "Set when the activity was imported from another tool.",
    }),
    externalUserAvatar: z.string().nullable(),
    externalSource: z.string().nullable().openapi({
      description: "The tool it was imported from, e.g. planka, trello, jira.",
    }),
    externalUrl: z.string().nullable(),
  })
  .openapi("Activity");

export const activityListSchema = z.array(activitySchema);

const workspaceActivityBase = z.object({
  id: z.string(),
  type: z.string().openapi({
    description: `${activityTypeDescription} Bug events: bug_created, bug_updated, bug_comment_created, bug_comment_updated.`,
  }),
  createdAt: responseTimestamp.openapi({
    description: "Event time; for bug comments, the latest edit time.",
  }),
  eventData: z.unknown().openapi({
    description:
      "Type-specific payload. Task status changes include current configured column names when available. Null for bug events.",
  }),
  excerpt: z.string().nullable().openapi({
    description: "Plain-text content preview, at most 240 characters.",
  }),
  userId: z.string().nullable(),
  userName: z.string().nullable(),
  userImage: z.string().nullable(),
  externalUserName: z.string().nullable(),
  externalUserAvatar: z.string().nullable(),
  projectId: z.string(),
  projectSlug: z.string(),
});
export const workspaceActivityListSchema = z.array(
  z
    .discriminatedUnion("resourceType", [
      workspaceActivityBase.extend({
        resourceType: z.literal("task"),
        taskId: z.string(),
        taskTitle: z.string(),
        taskNumber: z.number().nullable(),
      }),
      workspaceActivityBase.extend({
        resourceType: z.literal("bug"),
        bugId: z.string(),
        bugTitle: z.string(),
      }),
    ])
    .openapi("WorkspaceActivity"),
);
