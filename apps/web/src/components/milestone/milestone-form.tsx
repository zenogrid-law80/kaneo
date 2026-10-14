import { parseISO } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import type { Milestone, MilestoneInput } from "@/fetchers/milestone";
import { formatDateMedium } from "@/lib/format";
import { localDateString } from "@/lib/milestone-date";

export default function MilestoneForm({
  milestone,
  onSave,
  onClose,
}: {
  milestone?: Milestone;
  onSave: (input: MilestoneInput) => Promise<unknown>;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [name, setName] = useState(milestone?.name ?? "");
  const [description, setDescription] = useState(milestone?.description ?? "");
  const [dueDate, setDueDate] = useState(milestone?.dueDate ?? "");
  const [isCurrent, setIsCurrent] = useState(milestone?.isCurrent ?? false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const selectedDate = dueDate ? parseISO(dueDate) : undefined;
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
              <Textarea
                id="milestone-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={10000}
                disabled={pending}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="milestone-date" className="text-sm">
                {t("tasks:milestones.dueDate")}
              </label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger
                  render={<Button type="button" variant="outline" />}
                  id="milestone-date"
                  className="w-full justify-start gap-2"
                  disabled={pending}
                >
                  <CalendarIcon className="size-4" />
                  {selectedDate
                    ? formatDateMedium(selectedDate, i18n.resolvedLanguage)
                    : t("tasks:milestones.noDate")}
                </PopoverTrigger>
                <PopoverContent className="p-0" align="start">
                  <Calendar
                    mode="single"
                    defaultMonth={selectedDate}
                    selected={selectedDate}
                    onSelect={(date) => {
                      setDueDate(date ? localDateString(date) : "");
                      setDatePickerOpen(false);
                    }}
                    disabled={pending}
                    className="w-full bg-popover"
                  />
                  {selectedDate && (
                    <div className="pt-2 border-t border-border">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start gap-2 text-muted-foreground"
                        disabled={pending}
                        onClick={() => {
                          setDueDate("");
                          setDatePickerOpen(false);
                        }}
                      >
                        <X className="size-4" />
                        {t("tasks:popover.dueDate.clear")}
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
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
