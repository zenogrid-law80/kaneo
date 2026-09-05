export function getMyTaskDueGroup(dueDate: string | null, now = new Date()) {
  if (!dueDate) return "undated";
  const date = new Date(dueDate);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );
  if (date < today) return "overdue";
  if (date < tomorrow) return "today";
  return "upcoming";
}
