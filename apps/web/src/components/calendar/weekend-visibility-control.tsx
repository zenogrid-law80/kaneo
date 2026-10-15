import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type Props = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  hiddenCount?: number;
};

export default function WeekendVisibilityControl({
  checked,
  onCheckedChange,
  hiddenCount = 0,
}: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label className="min-h-11 cursor-pointer whitespace-nowrap text-xs sm:min-h-8">
        <Checkbox checked={checked} onCheckedChange={onCheckedChange} />
        {t("tasks:weekends.show")}
      </Label>
      {!checked && hiddenCount > 0 && (
        <Button variant="ghost" size="xs" onClick={() => onCheckedChange(true)}>
          {t("tasks:weekends.hiddenTasks", { count: hiddenCount })}
        </Button>
      )}
    </div>
  );
}
