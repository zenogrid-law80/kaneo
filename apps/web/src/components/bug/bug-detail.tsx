import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
} from "@/components/ui/dialog";
import { useBug } from "@/hooks/queries/bug/use-bugs";
import { useBugMutations } from "@/hooks/mutations/bug/use-bug-mutations";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import BugHistory from "./bug-history";
import BugForm from "./bug-form";

export default function BugDetail({
  projectId,
  workspaceId,
  id,
  onClose,
}: {
  projectId: string;
  workspaceId: string;
  id: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const query = useBug(projectId, id);
  const mutations = useBugMutations(projectId);
  const { canUpdateTasks, canDeleteTasks, canAssignTasks } =
    useWorkspacePermission();
  if (query.data && !query.isError)
    return (
      <BugForm
        projectId={projectId}
        workspaceId={workspaceId}
        canAssign={canAssignTasks()}
        bug={query.data}
        history={<BugHistory projectId={projectId} bugId={id} />}
        readOnly={!canUpdateTasks()}
        onClose={onClose}
        onSave={(input) => mutations.update.mutateAsync({ id, input })}
        onDelete={
          canDeleteTasks()
            ? async () => {
                await mutations.remove.mutateAsync(id);
                onClose();
              }
            : undefined
        }
      />
    );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("tasks:bugs.details")}</DialogTitle>
          <DialogDescription>
            {t("tasks:bugs.formDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          {query.isError ? (
            <div role="alert" className="space-y-3">
              <p>{t("tasks:bugs.detailError")}</p>
              <Button variant="outline" onClick={() => void query.refetch()}>
                {t("tasks:bugs.retry")}
              </Button>
            </div>
          ) : (
            <p role="status">{t("common:empty.loading")}</p>
          )}
        </DialogPanel>
        <DialogFooter>
          <Button onClick={onClose}>{t("common:actions.close")}</Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
