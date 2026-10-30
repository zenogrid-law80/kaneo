import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export default function BugPagination({
  page,
  totalPages,
  pending,
  onChange,
}: {
  page: number;
  totalPages: number;
  pending: boolean;
  onChange: (page: number) => void;
}) {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-between gap-2">
      <Button
        size="xs"
        variant="outline"
        disabled={page <= 1 || pending}
        onClick={() => onChange(page - 1)}
      >
        {t("common:pagination.previous")}
      </Button>
      <span className="text-xs text-muted-foreground">
        {page} / {totalPages}
      </span>
      <Button
        size="xs"
        variant="outline"
        disabled={page >= totalPages || pending}
        onClick={() => onChange(page + 1)}
      >
        {t("common:pagination.next")}
      </Button>
    </div>
  );
}
