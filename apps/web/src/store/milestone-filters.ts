import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const CURRENT_MILESTONE_FILTER = "__current__";

type MilestoneFilters = {
  byProject: Record<string, string | null>;
  initialize: (projectId: string, milestoneId: string | null) => void;
  select: (projectId: string, milestoneId: string | null) => void;
};

export const useMilestoneFilters = create<MilestoneFilters>()(
  persist(
    (set) => ({
      byProject: {},
      initialize: (projectId, milestoneId) => {
        if (!projectId) return;
        set((state) =>
          Object.hasOwn(state.byProject, projectId)
            ? state
            : { byProject: { ...state.byProject, [projectId]: milestoneId } },
        );
      },
      select: (projectId, milestoneId) => {
        if (!projectId) return;
        set((state) => ({
          byProject: { ...state.byProject, [projectId]: milestoneId },
        }));
      },
    }),
    {
      name: "kaneo-project-milestone-filters",
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          try {
            return window.localStorage.getItem(name);
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            window.localStorage.setItem(name, value);
          } catch {
            /* Keep the selection usable in memory. */
          }
        },
        removeItem: (name) => {
          try {
            window.localStorage.removeItem(name);
          } catch {
            /* Storage may be unavailable. */
          }
        },
      })),
      partialize: (state) => ({ byProject: state.byProject }),
      merge: (persisted, current) => {
        const stored = (persisted as Partial<MilestoneFilters> | null)
          ?.byProject;
        const entries =
          stored && typeof stored === "object"
            ? Object.entries(stored).filter(
                ([, value]) =>
                  value === null ||
                  (typeof value === "string" && value.length > 0),
              )
            : [];
        return { ...current, byProject: Object.fromEntries(entries) };
      },
    },
  ),
);
