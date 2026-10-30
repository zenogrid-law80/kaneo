import { LayoutGrid, List } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { BugSearch } from "./bug-search";

export default function BugViewSwitch({
  search,
  onChange,
}: {
  search: BugSearch;
  onChange: (search: Partial<BugSearch>) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="group"
      aria-label={t("tasks:bugs.view")}
      className="ml-auto flex shrink-0 gap-1"
    >
      <Button
        size="sm"
        variant={search.view === "list" ? "outline" : "secondary"}
        aria-pressed={search.view !== "list"}
        onClick={() => onChange({ view: "cards" })}
      >
        <LayoutGrid className="size-4" />
        {t("tasks:bugs.cardView")}
      </Button>
      <Button
        size="sm"
        variant={search.view === "list" ? "secondary" : "outline"}
        aria-pressed={search.view === "list"}
        onClick={() => onChange({ view: "list" })}
      >
        <List className="size-4" />
        {t("tasks:bugs.listView")}
      </Button>
    </div>
  );
}
