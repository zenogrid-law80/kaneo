import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { useUserPreferencesStore as store } from "./user-preferences";

beforeEach(() => {
  localStorage.clear();
  store.setState(store.getInitialState());
});
afterEach(() => {
  localStorage.clear();
  store.setState(store.getInitialState());
});

describe("weekend preferences", () => {
  it("starts unchecked for both views", () => {
    expect(store.getState().calendarShowWeekends).toBe(false);
    expect(store.getState().ganttShowWeekends).toBe(false);
  });
  it("persists each view independently and can turn both off again", async () => {
    store.getState().setCalendarShowWeekends(true);
    expect(store.getState().ganttShowWeekends).toBe(false);
    await store.persist.rehydrate();
    expect(store.getState().calendarShowWeekends).toBe(true);
    store.getState().setGanttShowWeekends(true);
    store.getState().setCalendarShowWeekends(false);
    await store.persist.rehydrate();
    expect(store.getState().calendarShowWeekends).toBe(false);
    expect(store.getState().ganttShowWeekends).toBe(true);
    store.getState().setGanttShowWeekends(false);
    expect(store.getState().ganttShowWeekends).toBe(false);
  });
  it("adds unchecked defaults to previously saved preferences", async () => {
    localStorage.setItem(
      "user-preferences",
      JSON.stringify({ state: { weekStartsOn: 1 }, version: 0 }),
    );
    await store.persist.rehydrate();
    expect(store.getState().calendarShowWeekends).toBe(false);
    expect(store.getState().ganttShowWeekends).toBe(false);
    expect(store.getState().weekStartsOn).toBe(1);
  });
});
