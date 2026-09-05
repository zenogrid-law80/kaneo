// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { favoriteScope, useProjectFavorites } from "./project-favorites";

// Node 26 exposes an unavailable localStorage getter in this test runtime.
vi.hoisted(() => {
  const data = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
      clear: () => data.clear(),
    },
  });
});

describe("project favorites", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useProjectFavorites.setState({ byScope: {} });
  });
  it("isolates accounts and workspaces and supports removing favorites", async () => {
    const toggle = useProjectFavorites.getState().toggle;
    toggle("user", "workspace", "project");
    toggle("other", "workspace", "other-project");
    toggle("user", "other-workspace", "third-project");
    await useProjectFavorites.persist.rehydrate();
    expect(
      useProjectFavorites.getState().byScope[
        favoriteScope("user", "workspace")
      ],
    ).toEqual(["project"]);
    toggle("user", "workspace", "project");
    expect(
      useProjectFavorites.getState().byScope[
        favoriteScope("user", "workspace")
      ],
    ).toEqual([]);
    expect(
      useProjectFavorites.getState().byScope[
        favoriteScope("other", "workspace")
      ],
    ).toEqual(["other-project"]);
    expect(
      useProjectFavorites.getState().byScope[
        favoriteScope("user", "other-workspace")
      ],
    ).toEqual(["third-project"]);
  });
});
