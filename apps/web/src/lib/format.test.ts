import { describe, expect, it, vi } from "vitest";
import { formatDate, formatRelativeTime } from "./format";

vi.mock("./i18n", () => ({ i18n: { language: "en-US" } }));

describe("timestamp presentation", () => {
  it("shows the same instant as now whether expressed in UTC or Korea time", () => {
    const now = new Date("2026-09-04T23:30:00Z");
    for (const timestamp of [
      "2026-09-04T23:30:00Z",
      "2026-09-05T08:30:00+09:00",
    ]) {
      expect(formatRelativeTime(timestamp, "en-US", now)).toBe("now");
      expect(formatRelativeTime(timestamp, "ko-KR", now)).toBe("지금");
    }
  });

  it("converts a UTC instant to the display timezone exactly once", () => {
    expect(
      formatDate(
        "2026-09-04T23:30:00Z",
        {
          timeZone: "Asia/Seoul",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        },
        "en-GB",
      ),
    ).toBe("08:30");
  });

  it("preserves genuine future timestamps instead of hiding a storage error", () => {
    expect(
      formatRelativeTime(
        "2026-09-05T08:30:00Z",
        "en-US",
        new Date("2026-09-04T23:30:00Z"),
      ),
    ).toBe("in 9 hours");
  });
});
