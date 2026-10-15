import { cleanup, render, screen } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { afterEach, expect, it, vi } from "vite-plus/test";
import en from "@i18n/en-US.json";
import ko from "@i18n/ko-KR.json";
import { Timeline } from "../ui/timeline";
import Activity from "./index";

vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "workspace" } }),
}));
vi.mock("@/hooks/queries/workspace-users/use-get-workspace-users", () => ({
  default: () => ({
    data: [{ user: { id: "actor", name: "Owner" } }],
  }),
}));
vi.mock("./comment-card", () => ({ default: () => null }));

afterEach(cleanup);

it.each([
  ["ko", "supporting_assignee_added", "Helper님을 보조 담당자로 지정했습니다"],
  [
    "ko",
    "supporting_assignee_removed",
    "Helper님을 보조 담당자에서 해제했습니다",
  ],
  ["en", "supporting_assignee_added", "added Helper as a supporting assignee"],
  [
    "en",
    "supporting_assignee_removed",
    "removed Helper as a supporting assignee",
  ],
])(
  "renders %s %s with the actor and saved target name",
  async (lng, type, text) => {
    const i18n = createInstance();
    await i18n.init({
      lng,
      resources: { en, ko },
      interpolation: { escapeValue: false },
    });
    render(
      <I18nextProvider i18n={i18n}>
        <Timeline>
          <Activity
            step={1}
            activity={{
              id: "activity",
              taskId: "task",
              userId: "actor",
              type,
              content: null,
              createdAt: "2026-10-14T10:00:00Z",
              eventData: {
                supportingAssigneeId: "helper",
                supportingAssigneeName: "Helper",
              },
            }}
          />
        </Timeline>
      </I18nextProvider>,
    );
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByText(text)).toBeInTheDocument();
  },
);
