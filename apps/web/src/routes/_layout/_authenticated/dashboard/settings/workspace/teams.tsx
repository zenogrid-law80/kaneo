import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2, UserRoundPlus, UsersRound } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import useWorkspaceTeams, {
  type WorkspaceTeam,
  workspaceTeamsQueryKey,
} from "@/hooks/queries/workspace/use-workspace-teams";
import useGetWorkspaceUsers from "@/hooks/queries/workspace-users/use-get-workspace-users";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { authClient } from "@/lib/auth-client";
import { getInitials } from "@/lib/get-initials";
import { toast } from "@/lib/toast";
import queryClient from "@/query-client";
import type WorkspaceUser from "@/types/workspace-user";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/teams",
)({ component: RouteComponent });

type Team = WorkspaceTeam;

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function RouteComponent() {
  const { t } = useTranslation();
  const { workspace, canManageTeams, isCheckingPermissions } =
    useWorkspacePermission();
  const workspaceId = workspace?.id ?? "";
  const canManage = canManageTeams();
  const { data: workspaceMembers = [] } = useGetWorkspaceUsers({ workspaceId });

  const { data: teams = [], isPending } = useWorkspaceTeams(workspaceId);

  const [nameDialog, setNameDialog] = useState<"create" | "edit" | null>(null);
  const [name, setName] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const refreshTeams = () =>
    queryClient.invalidateQueries({ queryKey: workspaceTeamsQueryKey() });

  const createTeam = useMutation({
    mutationFn: async (teamName: string) => {
      const { error } = await authClient.organization.createTeam({
        name: teamName,
        organizationId: workspaceId,
      });
      if (error)
        throw new Error(
          error.message || t("settings:workspaceTeams.createError"),
        );
    },
    onSuccess: refreshTeams,
  });

  const updateTeam = useMutation({
    mutationFn: async ({
      teamId,
      teamName,
    }: {
      teamId: string;
      teamName: string;
    }) => {
      const { error } = await authClient.organization.updateTeam({
        teamId,
        data: { name: teamName },
      });
      if (error)
        throw new Error(
          error.message || t("settings:workspaceTeams.updateError"),
        );
    },
    onSuccess: refreshTeams,
  });

  const removeTeam = useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await authClient.organization.removeTeam({
        teamId,
        organizationId: workspaceId,
      });
      if (error)
        throw new Error(
          error.message || t("settings:workspaceTeams.deleteError"),
        );
    },
    onSuccess: refreshTeams,
  });

  const openCreate = () => {
    setName("");
    setSelectedTeam(null);
    setNameDialog("create");
  };

  const openEdit = (team: Team) => {
    setName(team.name);
    setSelectedTeam(team);
    setNameDialog("edit");
  };

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      if (nameDialog === "create") {
        await createTeam.mutateAsync(trimmed);
        toast.success(t("settings:workspaceTeams.createSuccess"));
      } else if (selectedTeam) {
        await updateTeam.mutateAsync({
          teamId: selectedTeam.id,
          teamName: trimmed,
        });
        toast.success(t("settings:workspaceTeams.updateSuccess"));
      }
      setNameDialog(null);
    } catch (error) {
      toast.error(
        getErrorMessage(error, t("settings:workspaceTeams.saveError")),
      );
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 pb-12 sm:px-6">
      <PageTitle title={t("settings:workspaceTeams.title")} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">
            {t("settings:workspaceTeams.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("settings:workspaceTeams.description")}
          </p>
        </div>
        {canManage && !isCheckingPermissions && (
          <Button onClick={openCreate}>
            <Plus /> {t("settings:workspaceTeams.create")}
          </Button>
        )}
      </div>

      {!isPending && teams.length === 0 ? (
        <Empty className="rounded-2xl border py-14">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersRound />
            </EmptyMedia>
            <EmptyTitle>{t("settings:workspaceTeams.emptyTitle")}</EmptyTitle>
            <EmptyDescription>
              {t("settings:workspaceTeams.emptyDescription")}
            </EmptyDescription>
          </EmptyHeader>
          {canManage && (
            <Button onClick={openCreate}>
              <Plus /> {t("settings:workspaceTeams.create")}
            </Button>
          )}
        </Empty>
      ) : (
        <div className="grid gap-3">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              canManage={canManage}
              onEdit={() => openEdit(team)}
              onMembers={() => {
                setSelectedTeam(team);
                setMembersOpen(true);
              }}
              onDelete={() => {
                setSelectedTeam(team);
                setDeleteOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <Dialog
        open={nameDialog !== null}
        onOpenChange={(open) => !open && setNameDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {nameDialog === "create"
                ? t("settings:workspaceTeams.createTitle")
                : t("settings:workspaceTeams.editTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("settings:workspaceTeams.nameDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="team-name">
              {t("settings:workspaceTeams.name")}
            </Label>
            <Input
              id="team-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              onKeyDown={(event) => event.key === "Enter" && void saveName()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNameDialog(null)}>
              {t("settings:workspaceTeams.cancel")}
            </Button>
            <Button
              disabled={
                !name.trim() || createTeam.isPending || updateTeam.isPending
              }
              onClick={() => void saveName()}
            >
              {t("settings:workspaceTeams.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedTeam && (
        <ManageMembersDialog
          open={membersOpen}
          onOpenChange={setMembersOpen}
          team={selectedTeam}
          workspaceId={workspaceId}
          workspaceMembers={workspaceMembers}
        />
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings:workspaceTeams.deleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings:workspaceTeams.deleteDescription", {
                name: selectedTeam?.name,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {t("settings:workspaceTeams.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={removeTeam.isPending}
              onClick={async () => {
                if (!selectedTeam) return;
                try {
                  await removeTeam.mutateAsync(selectedTeam.id);
                  toast.success(t("settings:workspaceTeams.deleteSuccess"));
                  setDeleteOpen(false);
                } catch (error) {
                  toast.error(
                    getErrorMessage(
                      error,
                      t("settings:workspaceTeams.deleteError"),
                    ),
                  );
                }
              }}
            >
              {t("settings:workspaceTeams.delete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TeamCard({
  team,
  canManage,
  onEdit,
  onMembers,
  onDelete,
}: {
  team: Team;
  canManage: boolean;
  onEdit: () => void;
  onMembers: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{team.name}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("settings:workspaceTeams.memberCount", {
              count: team.userIds.length,
            })}
          </p>
        </div>
        {canManage && (
          <CardAction className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={onMembers}>
              <UserRoundPlus /> {t("settings:workspaceTeams.members")}
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={t("settings:workspaceTeams.edit")}
              onClick={onEdit}
            >
              <Pencil />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={t("settings:workspaceTeams.delete")}
              onClick={onDelete}
            >
              <Trash2 />
            </Button>
          </CardAction>
        )}
      </CardHeader>
    </Card>
  );
}

function ManageMembersDialog({
  open,
  onOpenChange,
  team,
  workspaceId,
  workspaceMembers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: Team;
  workspaceId: string;
  workspaceMembers: WorkspaceUser[];
}) {
  const { t } = useTranslation();
  const { data: teams = [] } = useWorkspaceTeams(workspaceId);
  const currentTeam = teams.find((candidate) => candidate.id === team.id);
  const memberIds = new Set(currentTeam?.userIds ?? team.userIds);
  const toggleMember = useMutation({
    mutationFn: async ({
      userId,
      included,
    }: {
      userId: string;
      included: boolean;
    }) => {
      const result = included
        ? await authClient.organization.removeTeamMember({
            teamId: team.id,
            userId,
            organizationId: workspaceId,
          })
        : await authClient.organization.addTeamMember({
            teamId: team.id,
            userId,
            organizationId: workspaceId,
          });
      if (result.error)
        throw new Error(
          result.error.message ||
            t("settings:workspaceTeams.memberUpdateError"),
        );
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: workspaceTeamsQueryKey() }),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("settings:workspaceTeams.manageMembersTitle", {
              name: team.name,
            })}
          </DialogTitle>
          <DialogDescription>
            {t("settings:workspaceTeams.manageMembersDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {workspaceMembers.map((member) => {
            const included = memberIds.has(member.userId);
            return (
              <div
                key={member.id}
                className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/60"
              >
                <Avatar className="size-8">
                  <AvatarImage src={member.user.image ?? ""} />
                  <AvatarFallback>
                    {getInitials(member.user.name, "?")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {member.user.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {member.user.email}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={included ? "outline" : "default"}
                  disabled={toggleMember.isPending}
                  onClick={async () => {
                    try {
                      await toggleMember.mutateAsync({
                        userId: member.userId,
                        included,
                      });
                    } catch (error) {
                      toast.error(
                        getErrorMessage(
                          error,
                          t("settings:workspaceTeams.memberUpdateError"),
                        ),
                      );
                    }
                  }}
                >
                  {included
                    ? t("settings:workspaceTeams.removeMember")
                    : t("settings:workspaceTeams.addMember")}
                </Button>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            {t("settings:workspaceTeams.done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
