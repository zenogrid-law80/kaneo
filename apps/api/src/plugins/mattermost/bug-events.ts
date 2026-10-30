import { and, eq, inArray } from "drizzle-orm";
import enUS from "../../../../../i18n/en-US.json";
import type { BugNotificationEvent } from "../../bug/event-types";
import { buildBugUrl } from "../../bug/url";
import db from "../../database";
import { bugTable, projectTable, userTable } from "../../database/schema";
import type { PluginContext } from "../types";
import { postToMattermost } from "./client";
import { normalizeMattermostConfig, type MattermostConfig } from "./config";

function escapeText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/@/g, "@\u200b");
}

async function sendBugEvent(
  event: BugNotificationEvent,
  context: PluginContext,
  kind: "bugCreated" | "bugAssigneesChanged",
) {
  const config = normalizeMattermostConfig(context.config as MattermostConfig);
  if (!config.events?.[kind] || context.projectId !== event.projectId) return;
  const [bug] = await db
    .select({
      workspaceId: projectTable.workspaceId,
      projectName: projectTable.name,
    })
    .from(bugTable)
    .innerJoin(projectTable, eq(bugTable.projectId, projectTable.id))
    .where(
      and(
        eq(bugTable.id, event.bugId),
        eq(bugTable.projectId, event.projectId),
      ),
    )
    .limit(1);
  if (!bug) return;
  const people = await db
    .select({ id: userTable.id, name: userTable.name })
    .from(userTable)
    .where(
      inArray(userTable.id, [
        event.userId,
        ...event.assignments.map(({ userId }) => userId),
      ]),
    );
  const actor =
    people.find((person) => person.id === event.userId)?.name ?? "Kaneo";
  const copy = enUS.settings.mattermostIntegration;
  const title = copy.events[kind];
  const body = (
    kind === "bugCreated" ? copy.bugCreatedMessage : copy.bugAssignedMessage
  ).replace("{{actor}}", actor);
  await postToMattermost(config.webhookUrl, {
    text: `${title}: ${escapeText(event.title)}`,
    attachments: [
      {
        color: "#dc2626",
        title: escapeText(event.title),
        title_link: buildBugUrl(bug.workspaceId, event.projectId, event.bugId),
        text: escapeText(body),
        fields: [
          { title: "Project", value: escapeText(bug.projectName), short: true },
          ...event.assignments.map(({ role, userId }) => ({
            title: enUS.notifications.bugRoles[role],
            value: escapeText(
              people.find((person) => person.id === userId)?.name ?? "—",
            ),
            short: true,
          })),
        ],
      },
    ],
  });
}

export async function handleBugCreated(
  event: BugNotificationEvent,
  context: PluginContext,
) {
  await sendBugEvent(event, context, "bugCreated");
}

export async function handleBugAssigneesChanged(
  event: BugNotificationEvent,
  context: PluginContext,
) {
  await sendBugEvent(event, context, "bugAssigneesChanged");
}
