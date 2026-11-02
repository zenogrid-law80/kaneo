import { useTranslation } from "react-i18next";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/menu";
import type { BugSearch } from "./bug-search";
import { bugMetadataFields } from "./bug-metadata";

export default function BugMetadataFilterItems({
  search,
  onChange,
}: {
  search: BugSearch;
  onChange: (patch: Partial<BugSearch>) => void;
}) {
  const { t } = useTranslation();
  return (
    <DropdownMenuGroup>
      {bugMetadataFields.map(({ key, label, values }) => {
        const selected = search[key]?.split(",") ?? [];
        return (
          <DropdownMenuSub key={key}>
            <DropdownMenuSubTrigger className="h-8 rounded-md text-sm">
              <span>{t(label)}</span>
              {selected.length > 0 && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {selected.length}
                </span>
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56">
              {Object.entries(values).map(([value, label]) => (
                <DropdownMenuCheckboxItem
                  key={value}
                  closeOnClick={false}
                  indicatorVariant="checkbox"
                  checked={selected.includes(value)}
                  onCheckedChange={() => {
                    const next = selected.includes(value)
                      ? selected.filter((id) => id !== value)
                      : [...selected, value];
                    onChange({ [key]: next.join(",") || undefined });
                  }}
                >
                  {t(label)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        );
      })}
    </DropdownMenuGroup>
  );
}
