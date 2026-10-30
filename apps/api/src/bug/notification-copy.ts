import enUS from "../../../../i18n/en-US.json";
import koKR from "../../../../i18n/ko-KR.json";

export function getBugNotificationContent(
  type: "bug_created" | "bug_assigned",
  data: Record<string, unknown> | null,
  locale?: string | null,
) {
  const copy = (locale?.toLowerCase().startsWith("ko") ? koKR : enUS)
    .notifications;
  const roles: unknown[] = Array.isArray(data?.roles) ? data.roles : [];
  const values: Record<string, string> = {
    bugTitle: typeof data?.bugTitle === "string" ? data.bugTitle : "Bug",
    roles: roles
      .flatMap((role) =>
        role === "fixer" || role === "verifier" ? [copy.bugRoles[role]] : [],
      )
      .join(", "),
  };
  const event = copy.events[type];
  return {
    title: event.title,
    body: event.content.replace(
      /\{\{(\w+)\}\}/g,
      (_match, key: string) => values[key] ?? "",
    ),
  };
}
