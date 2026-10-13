import { useEffect, useMemo } from "react";
import { useMilestoneFilters } from "@/store/milestone-filters";

function previousBoardMilestone(projectId: string) {
  try {
    const stored = window.localStorage.getItem(
      `kaneo:board-filters:${projectId}`,
    );
    const filters = stored ? JSON.parse(stored) : null;
    const value = Array.isArray(filters?.milestone)
      ? filters.milestone[0]
      : null;
    return typeof value === "string" && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export function useMilestoneFilter(
  projectId: string,
  initialMilestoneId?: string,
) {
  const selection = useMilestoneFilters((state) =>
    Object.hasOwn(state.byProject, projectId)
      ? state.byProject[projectId]
      : undefined,
  );
  const initialize = useMilestoneFilters((state) => state.initialize);
  const select = useMilestoneFilters((state) => state.select);
  const initial = useMemo(
    () => initialMilestoneId || previousBoardMilestone(projectId),
    [projectId, initialMilestoneId],
  );
  const milestoneId = selection === undefined ? initial : selection;

  useEffect(() => {
    if (selection === undefined) initialize(projectId, initial);
  }, [projectId, selection, initial, initialize]);

  return {
    milestoneId,
    setMilestoneId: (value: string | null) => select(projectId, value),
  };
}
