import { parseISO } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDateMedium } from "@/lib/format";
import { localDateString } from "@/lib/milestone-date";

export default function MilestoneDateField({
  id,
  label,
  emptyLabel,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  emptyLabel: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm">
        {label}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={<Button type="button" variant="outline" />}
          id={id}
          className="w-full justify-start gap-2"
          disabled={disabled}
        >
          <CalendarIcon className="size-4" />
          {selected
            ? formatDateMedium(selected, i18n.resolvedLanguage)
            : emptyLabel}
        </PopoverTrigger>
        <PopoverContent className="p-0" align="start">
          <Calendar
            mode="single"
            defaultMonth={selected}
            selected={selected}
            onSelect={(date) => {
              onChange(date ? localDateString(date) : "");
              setOpen(false);
            }}
            disabled={disabled}
            className="w-full bg-popover"
          />
          {selected && (
            <div className="pt-2 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-muted-foreground"
                disabled={disabled}
                onClick={() => {
                  onChange("");
                  setOpen(false);
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
  );
}
