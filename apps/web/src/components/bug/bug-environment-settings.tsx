import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  createBugEnvironment,
  updateBugEnvironment,
  type BugEnvironment,
} from "@/fetchers/bug";
import { useBugEnvironments } from "@/hooks/queries/bug/use-bugs";
import {
  BugEnvironmentProvider,
  useEnvironmentOptions,
} from "./bug-environments";

function EnvironmentRow({
  item,
  canEdit,
  busy,
  onUpdate,
}: {
  item: BugEnvironment;
  canEdit: boolean;
  busy: boolean;
  onUpdate: (
    id: string,
    value: { name?: string; archived?: boolean },
  ) => Promise<void>;
}) {
  const { t } = useTranslation();
  const { label } = useEnvironmentOptions();
  const [draft, setDraft] = useState<string>();
  const value = draft ?? label(item.id);
  return (
    <li className="flex flex-wrap items-center gap-2">
      <Input
        type="text"
        aria-label={`${label(item.id)} — ${t("tasks:bugs.environmentName")}`}
        value={value}
        maxLength={80}
        disabled={!canEdit || busy || item.archived}
        onChange={(event) => setDraft(event.target.value)}
        className="max-w-sm"
      />
      {canEdit && !item.archived && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={`${label(item.id)} — ${t("tasks:bugs.environmentRename")}`}
          disabled={busy || !value.trim() || value.trim() === label(item.id)}
          onClick={() =>
            void onUpdate(item.id, { name: value.trim() })
              .then(() => setDraft(undefined))
              .catch(() => {})
          }
        >
          {t("tasks:bugs.environmentRename")}
        </Button>
      )}
      {canEdit && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={`${label(item.id)} — ${t(item.archived ? "tasks:bugs.environmentRestore" : "tasks:bugs.environmentDelete")}`}
          disabled={busy}
          onClick={() =>
            void onUpdate(item.id, { archived: !item.archived }).catch(() => {})
          }
        >
          {t(
            item.archived
              ? "tasks:bugs.environmentRestore"
              : "tasks:bugs.environmentDelete",
          )}
        </Button>
      )}
      {item.archived && (
        <span className="text-xs text-muted-foreground">
          {t("tasks:bugs.environmentArchived")}
        </span>
      )}
    </li>
  );
}

function EnvironmentSettingsContent({
  projectId,
  canEdit,
}: {
  projectId: string;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const query = useBugEnvironments(projectId);
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const mutation = useMutation({
    mutationFn: async (input: {
      id?: string;
      name?: string;
      archived?: boolean;
    }) =>
      input.id
        ? updateBugEnvironment(projectId, input.id, {
            name: input.name,
            archived: input.archived,
          })
        : createBugEnvironment(projectId, input.name ?? ""),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["bug-environments", projectId],
      }),
  });
  return (
    <section className="space-y-3">
      <Field>
        <FieldLabel htmlFor={canEdit ? "new-bug-environment" : undefined}>
          {t("tasks:bugs.environmentSettingsTitle")}
        </FieldLabel>
        <FieldDescription>
          {t("tasks:bugs.environmentSettingsHint")}
        </FieldDescription>
        {canEdit && (
          <div className="flex w-full flex-wrap gap-2">
            <Input
              id="new-bug-environment"
              type="text"
              value={name}
              maxLength={80}
              placeholder={t("tasks:bugs.environmentName")}
              onChange={(e) => setName(e.target.value)}
              className="min-w-40 max-w-sm flex-1"
              disabled={mutation.isPending}
            />
            <Button
              type="button"
              disabled={!name.trim() || mutation.isPending}
              onClick={() =>
                void mutation
                  .mutateAsync({ name: name.trim() })
                  .then(() => setName(""))
                  .catch(() => {})
              }
            >
              {t("tasks:bugs.environmentAdd")}
            </Button>
          </div>
        )}
      </Field>
      {query.isPending && <p role="status">{t("common:empty.loading")}</p>}
      {query.isError && (
        <div role="alert">
          <p>{t("tasks:bugs.environmentLoadError")}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void query.refetch()}
          >
            {t("tasks:bugs.retry")}
          </Button>
        </div>
      )}
      {query.data && (
        <ul className="space-y-2">
          {query.data.map((item) => (
            <EnvironmentRow
              key={item.id}
              item={item}
              canEdit={canEdit}
              busy={mutation.isPending}
              onUpdate={(id, value) =>
                mutation.mutateAsync({ id, ...value }).then(() => {})
              }
            />
          ))}
        </ul>
      )}
      {mutation.isError && (
        <p role="alert" className="text-sm text-destructive">
          {t("tasks:bugs.environmentSaveError")}
        </p>
      )}
    </section>
  );
}
export default function BugEnvironmentSettings({
  projectId,
  canEdit,
}: {
  projectId: string;
  canEdit: boolean;
}) {
  return (
    <BugEnvironmentProvider projectId={projectId}>
      <EnvironmentSettingsContent projectId={projectId} canEdit={canEdit} />
    </BugEnvironmentProvider>
  );
}
