import { z } from "../openapi";

export const bugStatus = z.enum(["new", "in-progress", "resolved"]);
export const bugProjectParam = z.object({ projectId: z.string().min(1) });
export const bugParam = bugProjectParam.extend({ id: z.string().min(1) });
const peopleFilter = z
  .string()
  .min(1)
  .max(10000)
  .regex(/^[^,\s]+(?:,[^,\s]+)*$/)
  .optional();
export const listBugsQuery = z.object({
  status: bugStatus.optional(),
  reporterId: peopleFilter.openapi({
    description:
      "Filter by comma-separated reporter user IDs (OR), including 'none' for unassigned. Different filter fields are combined with AND.",
  }),
  fixerId: peopleFilter.openapi({
    description:
      "Filter by comma-separated fixer user IDs (OR), including 'none' for unassigned. Different filter fields are combined with AND.",
  }),
  verifierId: peopleFilter.openapi({
    description:
      "Filter by comma-separated verifier user IDs (OR), including 'none' for unassigned. Different filter fields are combined with AND.",
  }),
  milestoneId: z.string().min(1).optional().openapi({
    description:
      "Filter by project milestone ID, or 'none' for no milestone. All provided filters are combined with AND.",
  }),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
const bugAssignments = {
  reporterId: z.string().trim().min(1).nullable().optional().openapi({
    description:
      "Defaults to the authenticated creator when omitted on creation. Requires task:assign to set or clear. Must be a workspace member.",
  }),
  fixerId: z.string().trim().min(1).nullable().optional().openapi({
    description:
      "Workspace member responsible for fixing the bug. Requires task:assign. Use null to unassign.",
  }),
  verifierId: z.string().trim().min(1).nullable().optional().openapi({
    description:
      "Workspace member responsible for verifying the fix. Requires task:assign. Use null to unassign.",
  }),
};
export const createBugBody = z.strictObject({
  ...bugAssignments,
  milestoneId: z.string().min(1).nullable().optional().openapi({
    description:
      "An open milestone in this project, or null to leave unassigned.",
  }),
  title: z.string().trim().min(1).max(300),
  description: z.string().max(50000).optional().openapi({
    description: "Defaults to the project's current bug template when omitted.",
  }),
});
export const updateBugBody = z
  .strictObject({
    ...bugAssignments,
    milestoneId: z.string().min(1).nullable().optional().openapi({
      description:
        "An open milestone in this project, or null to unassign. An unchanged closed milestone may be retained.",
    }),
    title: z.string().trim().min(1).max(300).optional(),
    description: z.string().max(50000).optional(),
    status: bugStatus.optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required",
  );
export const bugTemplateBody = z.strictObject({
  template: z.string().trim().min(1).max(50000).nullable().openapi({
    description:
      "Use null to restore the default template. Changes apply only to future bugs.",
  }),
});
