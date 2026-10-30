import { useTranslation } from "react-i18next";
import type { Bug } from "@/fetchers/bug";
import BugPersonPicker from "./bug-person-picker";

export default function BugPeople({
  workspaceId,
  bug,
  reporterId,
  reporter,
  fixerId,
  verifierId,
  disabled,
  onFixerChange,
  onVerifierChange,
  onReporterChange,
}: {
  workspaceId: string;
  bug?: Bug;
  reporterId: string | null;
  reporter: Bug["reporter"];
  fixerId: string | null;
  verifierId: string | null;
  disabled: boolean;
  onFixerChange: (id: string | null) => void;
  onVerifierChange: (id: string | null) => void;
  onReporterChange: (id: string | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <BugPersonPicker
        workspaceId={workspaceId}
        label={t("tasks:bugs.reporter")}
        value={reporterId}
        person={reporter}
        disabled={disabled}
        onChange={onReporterChange}
      />
      <BugPersonPicker
        workspaceId={workspaceId}
        label={t("tasks:bugs.fixer")}
        value={fixerId}
        person={bug?.fixer ?? null}
        disabled={disabled}
        onChange={onFixerChange}
      />
      <BugPersonPicker
        workspaceId={workspaceId}
        label={t("tasks:bugs.verifier")}
        value={verifierId}
        person={bug?.verifier ?? null}
        disabled={disabled}
        onChange={onVerifierChange}
      />
    </div>
  );
}
