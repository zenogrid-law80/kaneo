import { client } from "@kaneo/libs";

async function getMemberTeamMonthlyStatistics(
  workspaceId: string,
  projectId?: string,
  startDate?: string,
  endDate?: string,
) {
  const response = await client.workspace[":workspaceId"][
    "member-team-monthly-statistics"
  ].$get({
    param: { workspaceId },
    query: { projectId, startDate, endDate },
  });

  if (!response.ok) throw new Error(await response.text());

  return response.json();
}

export default getMemberTeamMonthlyStatistics;
