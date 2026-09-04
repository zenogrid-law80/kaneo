import { client } from "@kaneo/libs";

async function getProjectMonthlyStatistics(
  workspaceId: string,
  projectId?: string,
  startDate?: string,
  endDate?: string,
) {
  const response = await client.workspace[":workspaceId"][
    "project-monthly-statistics"
  ].$get({
    param: { workspaceId },
    query: { projectId, startDate, endDate },
  });

  if (!response.ok) throw new Error(await response.text());

  return response.json();
}

export default getProjectMonthlyStatistics;
