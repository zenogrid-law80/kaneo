import type { BugAssignment } from "./event-types";

type Assignees = { fixerId: string | null; verifierId: string | null };

export function getBugAssignments(after: Assignees, before?: Assignees) {
  const assignments: BugAssignment[] = [];
  for (const role of ["fixer", "verifier"] as const) {
    const field = `${role}Id` as const;
    const userId = after[field];
    if (userId && userId !== before?.[field])
      assignments.push({ role, userId });
  }
  return assignments;
}
