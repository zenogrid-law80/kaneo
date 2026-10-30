import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import BugDescriptionEditor from "./bug-description-editor";
import { Radio, RadioGroup } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { Bug, BugStatus, BugUpdate } from "@/fetchers/bug";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import MilestoneSelect from "@/components/milestone/milestone-select";
import DeleteBug from "./delete-bug";
import BugPeople from "./bug-people";
import { bugStatuses, bugStatusKeys } from "./bug-status";

export default function BugForm({
  bug,
  workspaceId,
  projectId,
  canAssign = false,
  template,
  readOnly = false,
  onSave,
  onClose,
  onDelete,
  history,
}: {
  history?: ReactNode;
  bug?: Bug;
  workspaceId: string;
  projectId: string;
  canAssign?: boolean;
  template?: string;
  readOnly?: boolean;
  onSave: (
    input: BugUpdate & { title: string; description: string },
  ) => Promise<unknown>;
  onClose: () => void;
  onDelete?: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [initialTemplate] = useState(template ?? "");
  const [titleDraft, setTitle] = useState<string>();
  const [descriptionDraft, setDescription] = useState<string>();
  const [statusDraft, setStatus] = useState<BugStatus>();
  const [reporterDraft, setReporter] = useState<string | null>();
  const [milestoneDraft, setMilestone] = useState<string | null>();
  const [fixerDraft, setFixer] = useState<string | null>();
  const [verifierDraft, setVerifier] = useState<string | null>();
  // Realtime updates refresh untouched fields without discarding local edits.
  const title = titleDraft ?? bug?.title ?? "";
  const description = descriptionDraft ?? bug?.description ?? initialTemplate;
  const status = statusDraft ?? bug?.status ?? "new";
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const busy = pending || uploading;
  const [failed, setFailed] = useState(false);
  const items = bugStatuses.map((value) => ({
    value,
    label: t(bugStatusKeys[value]),
  }));
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogPopup
        className="sm:max-w-lg md:max-w-2xl lg:max-w-4xl"
        showCloseButton={!busy}
      >
        <form
          className="contents"
          onSubmit={async (event) => {
            event.preventDefault();
            if (readOnly || busy || !title.trim() || description.length > 50000)
              return;
            setPending(true);
            setFailed(false);
            try {
              await onSave({
                title: title.trim(),
                description,
                ...(bug ? { status } : {}),
                ...(canAssign && reporterDraft !== undefined
                  ? { reporterId: reporterDraft }
                  : {}),
                ...(milestoneDraft !== undefined
                  ? { milestoneId: milestoneDraft }
                  : {}),
                ...(canAssign && fixerDraft !== undefined
                  ? { fixerId: fixerDraft }
                  : {}),
                ...(canAssign && verifierDraft !== undefined
                  ? { verifierId: verifierDraft }
                  : {}),
              });
              onClose();
            } catch {
              setFailed(true);
            } finally {
              setPending(false);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {bug ? t("tasks:bugs.details") : t("tasks:bugs.create")}
            </DialogTitle>
            <DialogDescription>
              {t("tasks:bugs.formDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="mx-auto w-full max-w-3xl space-y-4 sm:px-8">
            <Field>
              <FieldLabel htmlFor="bug-title">
                {t("tasks:bugs.issueTitle")}
              </FieldLabel>
              <Input
                id="bug-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={300}
                readOnly={readOnly}
                disabled={busy}
              />
            </Field>
            {bug && (
              <fieldset className="space-y-2" disabled={busy || readOnly}>
                <legend className="text-sm font-medium">
                  {t("tasks:bugs.status")}
                </legend>
                <RadioGroup
                  value={status}
                  onValueChange={(value) => setStatus(value as BugStatus)}
                  disabled={busy || readOnly}
                  className="flex-row flex-wrap gap-4"
                  aria-label={t("tasks:bugs.status")}
                >
                  {items.map((item) => (
                    <Label key={item.value} className="flex items-center gap-2">
                      <Radio value={item.value} />
                      {item.label}
                    </Label>
                  ))}
                </RadioGroup>
              </fieldset>
            )}
            <BugPeople
              workspaceId={workspaceId}
              bug={bug}
              reporterId={
                reporterDraft !== undefined
                  ? reporterDraft
                  : bug
                    ? bug.reporterId
                    : (user?.id ?? null)
              }
              reporter={
                bug
                  ? bug.reporter
                  : user
                    ? {
                        id: user.id,
                        name: user.name,
                        image: user.image ?? null,
                      }
                    : null
              }
              onReporterChange={setReporter}
              fixerId={
                fixerDraft !== undefined ? fixerDraft : (bug?.fixerId ?? null)
              }
              verifierId={
                verifierDraft !== undefined
                  ? verifierDraft
                  : (bug?.verifierId ?? null)
              }
              disabled={busy || readOnly || !canAssign}
              onFixerChange={setFixer}
              onVerifierChange={setVerifier}
            />
            <Field>
              <FieldLabel>{t("tasks:milestones.title")}</FieldLabel>
              <MilestoneSelect
                projectId={projectId}
                value={
                  milestoneDraft !== undefined
                    ? milestoneDraft
                    : (bug?.milestoneId ?? null)
                }
                onChange={setMilestone}
                disabled={busy || readOnly}
              />
            </Field>
            <Field>
              <FieldLabel>{t("tasks:bugs.description")}</FieldLabel>
              <BugDescriptionEditor
                projectId={projectId}
                bugId={bug?.id}
                value={description}
                onChange={setDescription}
                readOnly={readOnly}
                disabled={pending}
                onUploadingChange={setUploading}
              />
              {description.length > 50000 && (
                <p role="alert" className="text-sm text-destructive">
                  {t("tasks:bugs.descriptionTooLong")}
                </p>
              )}
              {uploading && (
                <p role="status" className="text-sm text-muted-foreground">
                  {t("activity:comment.editor.uploadingFile")}
                </p>
              )}
            </Field>
            {history}
            {failed && (
              <p role="alert" className="text-sm text-destructive">
                {t("tasks:bugs.saveError")}
              </p>
            )}
          </DialogPanel>
          <DialogFooter>
            {onDelete && <DeleteBug disabled={busy} onDelete={onDelete} />}
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              {t("common:actions.close")}
            </Button>
            {!readOnly && (
              <Button
                type="submit"
                disabled={busy || !title.trim() || description.length > 50000}
              >
                {pending ? t("tasks:bugs.saving") : t("tasks:bugs.save")}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
