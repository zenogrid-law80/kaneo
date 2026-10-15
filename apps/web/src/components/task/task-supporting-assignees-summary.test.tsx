import en from "@i18n/en-US.json";
import ko from "@i18n/ko-KR.json";
import { cleanup, render, screen } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { afterEach, expect, it } from "vite-plus/test";
import TaskSupportingAssigneesSummary from "./task-supporting-assignees-summary";

afterEach(cleanup);

it.each(["en-US", "ko-KR"])(
  "labels names in %s, removes primary and duplicates, and exposes all names",
  async (lng) => {
    const i18n = createInstance();
    await i18n.init({ lng, resources: { "en-US": en, "ko-KR": ko } });
    render(
      <I18nextProvider i18n={i18n}>
        <TaskSupportingAssigneesSummary
          task={{
            userId: "owner",
            supportingAssignees: [
              { userId: "owner", name: "Owner" },
              { userId: "a", name: "Alice" },
              { userId: "a", name: "Alice" },
              { userId: "b", name: "Bob" },
              { userId: "c", name: "Charlie" },
            ],
          }}
        />
      </I18nextProvider>,
    );
    const label = lng === "ko-KR" ? "보조 담당자" : "Supporting assignees";
    const summary = screen.getByRole("group", {
      name: `${label}: Alice, Bob, Charlie`,
    });
    expect(summary).toHaveTextContent(`${label}: Alice, Bob`);
    expect(summary).toHaveTextContent("+1");
    expect(summary).toHaveAttribute("title", `${label}: Alice, Bob, Charlie`);
    expect(summary).not.toHaveTextContent("Owner");
  },
);

it("omits the summary for tasks without supporting members", () => {
  const { container } = render(
    <TaskSupportingAssigneesSummary task={{ userId: null }} />,
  );
  expect(container).toBeEmptyDOMElement();
});
