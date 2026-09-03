import { client } from "@kaneo/libs";

async function getWorkspaceTeams(workspaceId: string) {
  const response = await client.workspace[":workspaceId"].teams.$get({
    param: { workspaceId },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default getWorkspaceTeams;
