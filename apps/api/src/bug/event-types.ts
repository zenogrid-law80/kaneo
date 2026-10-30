export type BugAssignment = {
  role: "fixer" | "verifier";
  userId: string;
};

export type BugNotificationEvent = {
  bugId: string;
  projectId: string;
  userId: string;
  title: string;
  assignments: BugAssignment[];
};
