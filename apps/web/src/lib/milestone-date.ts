export function localDateString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function isMilestoneOverdue(
  milestone: { status: string; dueDate: string | null },
  today = localDateString(),
) {
  return (
    milestone.status === "open" &&
    milestone.dueDate !== null &&
    milestone.dueDate < today
  );
}
