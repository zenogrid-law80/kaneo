import { client } from "@kaneo/libs";

async function getMemberTeamMonthlyStatistics(
  workspaceId: string,
  projectId?: string,
  startDate?: string,
  endDate?: string,
  milestoneId?: string,
  includeSupportingAssignees = false,
) {
  const response = await client.workspace[":workspaceId"][
    "member-team-monthly-statistics"
  ].$get({
    param: { workspaceId },
    query: {
      projectId,
      startDate,
      endDate,
      milestoneId,
      includeSupportingAssignees: includeSupportingAssignees
        ? "true"
        : undefined,
    },
  });

  if (!response.ok) throw new Error(await response.text());

  return response.json();
}

export default getMemberTeamMonthlyStatistics;
