import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Milestone, MilestoneInput } from "@/fetchers/milestone";
import MilestoneDateField from "./milestone-date-field";

export default function MilestoneForm({
  milestone,
  onSave,
  onClose,
}: {
  milestone?: Milestone;
  onSave: (input: MilestoneInput) => Promise<unknown>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(milestone?.name ?? "");
  const [description, setDescription] = useState(milestone?.description ?? "");
  const [startDate, setStartDate] = useState(milestone?.startDate ?? "");
  const [dueDate, setDueDate] = useState(milestone?.dueDate ?? "");
  const [isCurrent, setIsCurrent] = useState(milestone?.isCurrent ?? false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogPopup>
        <form
          className="contents"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError(undefined);
            try {
              await onSave({
                name: name.trim(),
                description: description || null,
                startDate: startDate || null,
                dueDate: dueDate || null,
                isCurrent,
              });
              onClose();
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : t("tasks:milestones.saveError"),
              );
            } finally {
              setPending(false);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {milestone
                ? t("tasks:milestones.edit")
                : t("tasks:milestones.create")}
            </DialogTitle>
            <DialogDescription>
              {t("tasks:milestones.formDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="milestone-name" className="text-sm">
                {t("tasks:milestones.name")}
              </label>
              <Input
                id="milestone-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={200}
                disabled={pending}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="milestone-description" className="text-sm">
                {t("tasks:milestones.description")}
              </label>
              <p className="text-xs text-muted-foreground">
                {t("tasks:milestones.markdownHint")}
              </p>
              <Textarea
                id="milestone-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={10000}
                disabled={pending}
              />
            </div>
            <MilestoneDateField
              id="milestone-start-date"
              label={t("tasks:milestones.startDate")}
              emptyLabel={t("tasks:milestones.noStartDate")}
              value={startDate}
              onChange={setStartDate}
              disabled={pending}
            />
            <MilestoneDateField
              id="milestone-date"
              label={t("tasks:milestones.dueDate")}
              emptyLabel={t("tasks:milestones.noDate")}
              value={dueDate}
              onChange={setDueDate}
              disabled={pending}
            />
            {milestone?.status !== "closed" && (
              <div className="space-y-1">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={isCurrent}
                    onCheckedChange={setIsCurrent}
                    disabled={pending}
                  />
                  {t("tasks:milestones.setCurrent")}
                </label>
                <p className="text-xs text-muted-foreground">
                  {t("tasks:milestones.currentDescription")}
                </p>
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </DialogPanel>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={onClose}
            >
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {t("tasks:milestones.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
