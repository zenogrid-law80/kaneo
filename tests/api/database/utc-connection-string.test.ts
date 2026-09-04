import { describe, expect, it } from "vitest";
import { withUtcDatabaseSession } from "../../../apps/api/src/database/utc-connection-string";

describe("UTC database sessions", () => {
  it("preserves connection credentials, SSL and unrelated startup options", () => {
    const original = new URL(
      "postgresql://app:p%40ss@localhost:5432/kaneo?sslmode=require&application_name=kaneo",
    );
    original.searchParams.set("options", "-c statement_timeout=5000");
    const result = new URL(withUtcDatabaseSession(original.toString()));

    expect(result.username).toBe(original.username);
    expect(result.password).toBe(original.password);
    expect(result.host).toBe(original.host);
    expect(result.pathname).toBe(original.pathname);
    expect(result.searchParams.get("sslmode")).toBe("require");
    expect(result.searchParams.get("application_name")).toBe("kaneo");
    expect(result.searchParams.get("options")).toBe(
      "-c statement_timeout=5000 -c timezone=UTC",
    );
  });

  it("overrides an explicit non-UTC timezone without dropping other options", () => {
    const original = new URL("postgresql://localhost/kaneo");
    original.searchParams.set("options", "-c timezone=Asia/Seoul");
    const result = new URL(withUtcDatabaseSession(original.toString()));
    expect(result.searchParams.get("options")).toBe(
      "-c timezone=Asia/Seoul -c timezone=UTC",
    );
  });
});
