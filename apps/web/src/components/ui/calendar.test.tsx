import { act, cleanup, render, screen } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { Calendar } from "./calendar";

afterEach(cleanup);

describe("calendar month localization", () => {
  it("updates the caption and all month options when the app language changes", async () => {
    const i18n = createInstance();
    await i18n.init({
      lng: "ko-KR",
      resources: { "ko-KR": { common: {} }, "en-US": { common: {} } },
    });
    render(
      <I18nextProvider i18n={i18n}>
        <Calendar
          defaultMonth={new Date(2026, 9, 15)}
          captionLayout="dropdown-months"
        />
      </I18nextProvider>,
    );
    for (let month = 1; month <= 12; month++) {
      expect(screen.getByRole("option", { name: `${month}월` })).toBeTruthy();
    }
    expect(screen.getByText("10월", { selector: "span" })).toBeTruthy();
    await act(() => i18n.changeLanguage("en-US"));
    expect(screen.getByRole("option", { name: "Oct" })).toBeTruthy();
    expect(screen.getByText("Oct", { selector: "span" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "10월" })).toBeNull();
  });

  it("localizes the standard caption while keeping custom formatters", async () => {
    const i18n = createInstance();
    await i18n.init({
      lng: "ko-KR",
      resources: { "ko-KR": { common: {} } },
    });
    const { rerender } = render(
      <I18nextProvider i18n={i18n}>
        <Calendar defaultMonth={new Date(2026, 9, 15)} />
      </I18nextProvider>,
    );
    expect(screen.getByText("2026년 10월")).toBeTruthy();
    rerender(
      <I18nextProvider i18n={i18n}>
        <Calendar
          defaultMonth={new Date(2026, 9, 15)}
          formatters={{ formatCaption: () => "Custom month" }}
        />
      </I18nextProvider>,
    );
    expect(screen.getByText("Custom month")).toBeTruthy();
  });
});
