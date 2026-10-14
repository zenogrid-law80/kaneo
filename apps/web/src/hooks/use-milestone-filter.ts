import { useEffect, useMemo } from "react";
import { useCurrentMilestone } from "@/hooks/queries/milestone/use-current-milestone";
import {
  CURRENT_MILESTONE_FILTER,
  useMilestoneFilters,
} from "@/store/milestone-filters";

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
    () =>
      initialMilestoneId ||
      previousBoardMilestone(projectId) ||
      CURRENT_MILESTONE_FILTER,
    [projectId, initialMilestoneId],
  );
  const preference = selection === undefined ? initial : selection;
  const current = useCurrentMilestone(
    projectId,
    preference === CURRENT_MILESTONE_FILTER,
  );
  const milestoneId =
    preference === CURRENT_MILESTONE_FILTER
      ? (current.data?.id ?? null)
      : preference;

  useEffect(() => {
    if (selection === undefined) initialize(projectId, initial);
  }, [projectId, selection, initial, initialize]);

  return {
    milestoneId,
    setMilestoneId: (value: string | null) => select(projectId, value),
  };
}
