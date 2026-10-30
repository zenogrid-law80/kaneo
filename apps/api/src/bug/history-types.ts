export const bugHistoryFields = [
  "title",
  "description",
  "status",
  "reporterId",
  "fixerId",
  "verifierId",
  "milestoneId",
] as const;

export type BugChange = {
  field: (typeof bugHistoryFields)[number];
  before: string | null;
  after: string | null;
  beforeLabel?: string | null;
  afterLabel?: string | null;
};
