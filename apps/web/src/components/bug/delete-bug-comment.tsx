import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogClose,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export default function DeleteBugComment({
  disabled,
  onDelete,
}: {
  disabled: boolean;
  onDelete: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) {
          setOpen(value);
          setFailed(false);
        }
      }}
    >
      <AlertDialogTrigger
        render={
          <Button type="button" variant="ghost" size="xs" disabled={disabled} />
        }
      >
        {t("common:actions.delete")}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("tasks:bugs.deleteCommentTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("tasks:bugs.deleteCommentDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {failed && (
          <p role="alert" className="px-6 text-sm text-destructive">
            {t("tasks:bugs.commentDeleteError")}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogClose
            render={
              <Button type="button" variant="outline" disabled={pending} />
            }
          >
            {t("common:actions.cancel")}
          </AlertDialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setFailed(false);
              try {
                await onDelete();
                setOpen(false);
              } catch {
                setFailed(true);
              } finally {
                setPending(false);
              }
            }}
          >
            {pending
              ? t("common:actions.deleting")
              : t("common:actions.delete")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
