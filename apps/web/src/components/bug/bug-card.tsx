import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { BugSummary } from "@/fetchers/bug";
import BugCardContent from "./bug-card-content";

export default function BugCard({
  bug,
  disabled,
  onSelect,
}: {
  bug: BugSummary;
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } =
    useDraggable({ id: bug.id, data: { bug, status: bug.status }, disabled });
  return (
    <div
      role="group"
      aria-label={bug.title}
      ref={setNodeRef}
      onMouseDown={(event) => listeners?.onMouseDown?.(event)}
      onTouchStart={(event) => listeners?.onTouchStart?.(event)}
      className="relative rounded-lg border bg-card shadow-xs transition-colors hover:bg-accent"
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <button
        type="button"
        className="block w-full rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
        onClick={() => {
          if (!isDragging) onSelect(bug.id);
        }}
      >
        <BugCardContent bug={bug} />
      </button>
      {!disabled && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          onKeyDown={(event) => listeners?.onKeyDown?.(event)}
          aria-label={t("tasks:bugs.dragBug", { title: bug.title })}
          className="absolute right-2 top-3 cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
      )}
    </div>
  );
}
