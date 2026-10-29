import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
} from "@/components/ui/command";
import { DialogTitle } from "@/components/ui/dialog";
import useGlobalSearch from "@/hooks/queries/search/use-global-search";

type TaskRelationPickerProps = {
  title: string;
  searchHint: string;
  emptyMessage: string;
  workspaceId: string;
  excludedTaskIds: string[];
  isPending: boolean;
  onSelect: (taskId: string) => Promise<void>;
  onClose: () => void;
};

export default function TaskRelationPicker({
  title,
  searchHint,
  emptyMessage,
  workspaceId,
  excludedTaskIds,
  isPending,
  onSelect,
  onClose,
}: TaskRelationPickerProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const normalizedQuery = query.trim();

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(normalizedQuery), 250);
    return () => clearTimeout(timeout);
  }, [normalizedQuery]);

  const { data, isFetching, isError, refetch } = useGlobalSearch({
    q: debouncedQuery,
    type: "tasks",
    workspaceId,
    limit: 50,
  });
  const searching = isFetching || normalizedQuery !== debouncedQuery;
  const items =
    !searching && normalizedQuery && !isError
      ? (data?.results ?? []).filter(
          (item) => item.type === "task" && !excludedTaskIds.includes(item.id),
        )
      : [];

  return (
    <CommandDialog
      open
      onOpenChange={(open) => {
        if (!open && !isPending) onClose();
      }}
    >
      <CommandDialogPopup aria-describedby={undefined}>
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <Command items={items} filter={null}>
          <CommandInput
            aria-label={t("tasks:relations.searchPlaceholder")}
            placeholder={t("tasks:relations.searchPlaceholder")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={512}
            disabled={isPending}
          />
          <CommandPanel>
            <CommandEmpty>
              {searching ? (
                <span role="status">{t("tasks:relations.searching")}</span>
              ) : isError ? (
                <div role="alert">
                  {t("tasks:relations.searchError")}{" "}
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => void refetch()}
                  >
                    {t("tasks:relations.retry")}
                  </Button>
                </div>
              ) : normalizedQuery ? (
                emptyMessage
              ) : (
                searchHint
              )}
            </CommandEmpty>
            <CommandList>
              {(item) => (
                <CommandItem
                  key={item.id}
                  value={item}
                  disabled={isPending}
                  onClick={() => void onSelect(item.id)}
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate">{item.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.projectSlug}-{item.taskNumber} · {item.projectName}
                    </span>
                  </div>
                </CommandItem>
              )}
            </CommandList>
          </CommandPanel>
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  );
}
