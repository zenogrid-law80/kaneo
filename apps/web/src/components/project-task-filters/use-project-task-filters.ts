import { addWeeks, endOfWeek, isWithinInterval, startOfWeek } from "date-fns";
import { useMemo, useState } from "react";
import { useMilestoneFilter } from "@/hooks/use-milestone-filter";
import {
  DUE_DATE_FILTER_VALUES,
  UNASSIGNED_FILTER_VALUE,
} from "@/hooks/use-task-filters";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type { ProjectWithTasks } from "@/types/project";
import type { DueDateFilter } from "./types";

export function useProjectTaskFilters(
  project: ProjectWithTasks | null | undefined,
  projectId: string,
) {
  const { milestoneId, setMilestoneId } = useMilestoneFilter(projectId);
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [assigneeFilters, setAssigneeFilters] = useState<string[]>([]);
  const [dueDateFilter, setDueDateFilter] = useState<DueDateFilter>("all");
  const [labelFilters, setLabelFilters] = useState<string[]>([]);

  const [filterProjectId, setFilterProjectId] = useState(projectId);
  if (filterProjectId !== projectId) {
    setFilterProjectId(projectId);
    setStatusFilters([]);
    setAssigneeFilters([]);
    setDueDateFilter("all");
    setLabelFilters([]);
  }

  const visibleTasks = useMemo(() => {
    if (!project) return [];

    const tasks = [
      ...project.plannedTasks,
      ...project.columns.flatMap((column) => column.tasks),
    ].filter((task) => {
      if (milestoneId && (task.milestoneId ?? "none") !== milestoneId) {
        return false;
      }
      if (statusFilters.length > 0 && !statusFilters.includes(task.status)) {
        return false;
      }
      if (
        assigneeFilters.length > 0 &&
        !assigneeFilters.includes(task.userId ?? UNASSIGNED_FILTER_VALUE)
      ) {
        return false;
      }

      if (dueDateFilter !== "all") {
        if (dueDateFilter === DUE_DATE_FILTER_VALUES.noDueDate) {
          if (task.dueDate) return false;
        } else {
          if (!task.dueDate) return false;
          const today = new Date();
          const taskDate = new Date(task.dueDate);
          const weekOffset =
            dueDateFilter === DUE_DATE_FILTER_VALUES.dueNextWeek ? 1 : 0;
          const targetDate = addWeeks(today, weekOffset);
          if (
            !isWithinInterval(taskDate, {
              start: startOfWeek(targetDate, { weekStartsOn }),
              end: endOfWeek(targetDate, { weekStartsOn }),
            })
          ) {
            return false;
          }
        }
      }

      if (
        labelFilters.length > 0 &&
        !labelFilters.some((labelId) =>
          task.labels?.some((label) => label.id === labelId),
        )
      ) {
        return false;
      }

      return true;
    });

    return tasks;
  }, [
    assigneeFilters,
    dueDateFilter,
    labelFilters,
    milestoneId,
    project,
    statusFilters,
    weekStartsOn,
  ]);

  const activeFilterCount =
    Number(statusFilters.length > 0) +
    Number(assigneeFilters.length > 0) +
    Number(dueDateFilter !== "all") +
    Number(labelFilters.length > 0);

  return {
    milestoneId,
    setMilestoneId,
    statusFilters,
    setStatusFilters,
    assigneeFilters,
    setAssigneeFilters,
    dueDateFilter,
    setDueDateFilter,
    labelFilters,
    setLabelFilters,
    activeFilterCount,
    visibleTasks,
  };
}
