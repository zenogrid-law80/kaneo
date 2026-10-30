import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useBugTemplate } from "@/hooks/queries/bug/use-bugs";
import { useUpdateBugTemplate } from "@/hooks/mutations/bug/use-bug-mutations";

export default function BugTemplateSettings({
  projectId,
  canEdit,
}: {
  projectId: string;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const query = useBugTemplate(projectId);
  const mutation = useUpdateBugTemplate(projectId);
  const [draft, setDraft] = useState<string>();
  const [saved, setSaved] = useState(false);
  if (query.isPending) return <p role="status">{t("common:empty.loading")}</p>;
  if (query.isError)
    return (
      <div role="alert" className="space-y-2">
        <p>{t("tasks:bugs.templateLoadError")}</p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          {t("tasks:bugs.retry")}
        </Button>
      </div>
    );
  const value = draft ?? query.data.template;
  async function save(template: string | null) {
    setSaved(false);
    try {
      await mutation.mutateAsync(template);
      setDraft(undefined);
      setSaved(true);
    } catch {
      /* Mutation state presents the error. */
    }
  }
  return (
    <section className="space-y-3">
      <Field>
        <FieldLabel htmlFor="bug-template">
          {t("tasks:bugs.templateTitle")}
        </FieldLabel>
        <FieldDescription>{t("tasks:bugs.templateHint")}</FieldDescription>
        <Textarea
          id="bug-template"
          className="min-h-72 font-mono text-sm"
          value={value}
          maxLength={50000}
          readOnly={!canEdit}
          disabled={mutation.isPending}
          onChange={(e) => {
            setDraft(e.target.value);
            setSaved(false);
          }}
        />
      </Field>
      {mutation.isError && (
        <p role="alert" className="text-sm text-destructive">
          {t("tasks:bugs.saveError")}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("tasks:bugs.templateSaved")}
        </p>
      )}
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={
              mutation.isPending ||
              !value.trim() ||
              value === query.data.template
            }
            onClick={() => void save(value)}
          >
            {mutation.isPending
              ? t("tasks:bugs.saving")
              : t("tasks:bugs.saveTemplate")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending || query.data.isDefault}
            onClick={() => void save(null)}
          >
            {t("tasks:bugs.resetTemplate")}
          </Button>
        </div>
      )}
    </section>
  );
}
