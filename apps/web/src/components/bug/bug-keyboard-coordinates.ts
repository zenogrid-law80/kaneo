import type { KeyboardCoordinateGetter } from "@dnd-kit/core";
import { bugStatuses } from "./bug-status";

export const bugKeyboardCoordinates: KeyboardCoordinateGetter = (
  event,
  { context, currentCoordinates },
) => {
  const direction = ["ArrowRight", "ArrowDown"].includes(event.code)
    ? 1
    : ["ArrowLeft", "ArrowUp"].includes(event.code)
      ? -1
      : 0;
  if (!direction || !context.collisionRect) return;
  event.preventDefault();
  const current = context.over?.id ?? context.active?.data.current?.status;
  const index = bugStatuses.findIndex((status) => status === current);
  const next = bugStatuses[index + direction];
  const rect = next && context.droppableRects.get(next);
  if (!rect) return;
  return {
    x:
      currentCoordinates.x +
      rect.left +
      rect.width / 2 -
      context.collisionRect.left -
      context.collisionRect.width / 2,
    y:
      currentCoordinates.y +
      rect.top +
      rect.height / 2 -
      context.collisionRect.top -
      context.collisionRect.height / 2,
  };
};
