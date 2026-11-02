import { Search, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function BugTextSearch({
  value,
  onChange,
}: {
  value?: string;
  onChange: (value?: string) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value ?? "");
  const [previous, setPrevious] = useState(value);
  if (previous !== value) {
    setPrevious(value);
    setDraft(value ?? "");
  }
  return (
    <form
      role="search"
      aria-label={t("tasks:bugs.searchPlaceholder")}
      className="flex items-center gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        onChange(draft.trim() || undefined);
      }}
    >
      <Input
        type="search"
        aria-label={t("tasks:bugs.searchPlaceholder")}
        placeholder={t("tasks:bugs.searchPlaceholder")}
        value={draft}
        maxLength={200}
        className="h-7 w-48 text-xs sm:w-56"
        onChange={(event) => {
          setDraft(event.target.value);
          if (!event.target.value) onChange(undefined);
        }}
      />
      <Button
        type="submit"
        size="icon-xs"
        variant="outline"
        aria-label={t("tasks:bugs.searchAction")}
      >
        <Search className="size-3.5" />
      </Button>
      {(draft || value) && (
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label={t("tasks:bugs.clearSearch")}
          onClick={() => {
            setDraft("");
            onChange(undefined);
          }}
        >
          <X className="size-3.5" />
        </Button>
      )}
    </form>
  );
}
