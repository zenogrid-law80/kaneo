import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export function favoriteScope(userId: string, workspaceId: string) {
  return JSON.stringify([userId, workspaceId]);
}

type ProjectFavorites = {
  byScope: Record<string, string[]>;
  toggle: (userId: string, workspaceId: string, projectId: string) => void;
};

export const useProjectFavorites = create<ProjectFavorites>()(
  persist(
    (set) => ({
      byScope: {},
      toggle: (userId, workspaceId, projectId) => {
        if (!userId || !workspaceId || !projectId) return;
        const scope = favoriteScope(userId, workspaceId);
        set((state) => {
          const ids = state.byScope[scope] ?? [];
          return {
            byScope: {
              ...state.byScope,
              [scope]: ids.includes(projectId)
                ? ids.filter((id) => id !== projectId)
                : [...ids, projectId],
            },
          };
        });
      },
    }),
    {
      name: "kaneo-project-favorites",
      version: 1,
      storage: createJSONStorage(() => window.localStorage),
    },
  ),
);
