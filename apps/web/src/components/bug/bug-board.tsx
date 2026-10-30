import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
} from "@dnd-kit/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { BugFilters, BugSummary } from "@/fetchers/bug";
import { useBugMutations } from "@/hooks/mutations/bug/use-bug-mutations";
import BugColumn from "./bug-column";
import BugCardContent from "./bug-card-content";
import { bugStatuses } from "./bug-status";
import { bugKeyboardCoordinates } from "./bug-keyboard-coordinates";

export default function BugBoard({
  projectId,
  filters,
  canMove,
  onSelect,
}: {
  projectId: string;
  filters: BugFilters;
  canMove: boolean;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [active, setActive] = useState<BugSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const { update } = useBugMutations(projectId);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: bugKeyboardCoordinates }),
  );
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {t("tasks:bugs.dragHint")}
      </p>
      {update.isPending && (
        <p role="status" className="text-sm">
          {t("tasks:bugs.moving")}
        </p>
      )}
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {t("tasks:bugs.moveError")}
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={(args) => {
          const pointer = pointerWithin(args);
          return pointer.length ? pointer : rectIntersection(args);
        }}
        accessibility={{
          screenReaderInstructions: {
            draggable: t("tasks:bugs.dragInstructions"),
          },
        }}
        onDragStart={({ active }) => {
          if (canMove && !update.isPending) {
            setFailed(false);
            setActive(active.data.current?.bug ?? null);
          }
        }}
        onDragCancel={() => setActive(null)}
        onDragEnd={async ({ over }) => {
          const bug = active;
          setActive(null);
          const status = bugStatuses.find((status) => status === over?.id);
          if (
            !canMove ||
            update.isPending ||
            !bug ||
            !status ||
            status === bug.status
          )
            return;
          try {
            await update.mutateAsync({ id: bug.id, input: { status } });
          } catch {
            setFailed(true);
          }
        }}
      >
        <div className="grid items-start gap-4 lg:grid-cols-3">
          {bugStatuses.map((status) => (
            <BugColumn
              key={status}
              projectId={projectId}
              status={status}
              filters={filters}
              onSelect={onSelect}
              disabled={!canMove || update.isPending}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {active && (
            <div className="rounded-lg border bg-card shadow-xl">
              <BugCardContent bug={active} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
