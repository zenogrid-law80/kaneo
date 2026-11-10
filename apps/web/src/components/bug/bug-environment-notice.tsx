import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useEnvironmentOptions } from "./bug-environments";

export default function BugEnvironmentNotice() {
  const { t } = useTranslation();
  const { error, retry } = useEnvironmentOptions();
  if (!error) return null;
  return (
    <div role="alert" className="flex items-center gap-2 text-sm">
      <p>{t("tasks:bugs.environmentLoadError")}</p>
      <Button type="button" variant="outline" size="sm" onClick={retry}>
        {t("tasks:bugs.retry")}
      </Button>
    </div>
  );
}
