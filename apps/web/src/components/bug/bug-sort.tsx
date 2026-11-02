import { ArrowDownUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import type { BugSearch } from "./bug-search";
import { bugSortKeys } from "./bug-metadata";

export default function BugSort({
  search,
  onChange,
}: {
  search: BugSearch;
  onChange: (patch: Partial<BugSearch>) => void;
}) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("tasks:sort.label")}
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 rounded-md px-2.5 text-xs"
          />
        }
      >
        <ArrowDownUp className="size-3.5" />
        {t("tasks:sort.label")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("tasks:sort.by")}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuRadioGroup
          value={search.sortBy ?? "createdAt"}
          onValueChange={(value) =>
            onChange({ sortBy: value as BugSearch["sortBy"] })
          }
        >
          {Object.entries(bugSortKeys).map(([value, label]) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {t(label)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("tasks:sort.direction")}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuRadioGroup
          value={search.sortOrder ?? "desc"}
          onValueChange={(value) =>
            onChange({ sortOrder: value as BugSearch["sortOrder"] })
          }
        >
          <DropdownMenuRadioItem value="asc">
            {t("tasks:sort.ascending")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="desc">
            {t("tasks:sort.descending")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
