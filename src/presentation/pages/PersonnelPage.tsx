import { useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { Personnel } from "yotuvia-core";

import { InvitationModal, PersonnelFormModal } from "@/presentation/components/personnel";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  Skeleton,
  useToast,
} from "@/presentation/components/ui";
import { useAuthSession } from "@/presentation/hooks/use-auth-session";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import {
  useCenterPersonnel,
  useCreatePersonnel,
  useDeletePersonnel,
  useGenerateInvitation,
  useUpdatePersonnel,
} from "@/presentation/hooks/use-personnel";
import { toErrorKey, useErrorMessage } from "@/presentation/lib/errors";
import {
  EMPTY_PERSONNEL_FORM,
  personnelToFormValues,
  toCreatePersonnelData,
  toUpdatePersonnelData,
} from "@/presentation/schemas/personnel.schemas";
import type { InvitationFormValues, PersonnelFormValues } from "@/presentation/schemas/personnel.schemas";

type PersonnelFormTarget = { mode: "create" } | { mode: "edit"; personnel: Personnel };

function initialsOf(personnel: Personnel): string {
  return `${personnel.firstName.charAt(0)}${personnel.lastName.charAt(0)}`.toUpperCase();
}

/**
 * Center staff at the app personnel route.
 *
 * `GetPersonnelUseCase.execute(centerId)` maps to `GET /personnel`, already
 * scoped to the center, and returns the fields the list shows (name, email,
 * phone, active). Gallery images are NOT part of this payload — the core mapper
 * only resolves them on the public detail response — so no image is rendered
 * here.
 *
 * The invitation flow reuses `GenerateInvitationUseCase` and presents the
 * returned link as an openable web URL (see `InvitationModal`).
 * `listInvitations` has no use-case in the container, so pending invitations are
 * not listed; `getInvitationByToken` / `acceptInvitation` serve the PUBLIC
 * `/join/:token` acceptance flow (see `use-join-invitation`), not this owner
 * section.
 */
export function PersonnelPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("web.app.personnel.meta.title"));

  const { user } = useAuthSession();
  const centerId = Number(user?.id ?? 0);
  const { toast } = useToast();

  const personnelQuery = useCenterPersonnel(centerId);
  const createPersonnel = useCreatePersonnel();
  const updatePersonnel = useUpdatePersonnel();
  const deletePersonnel = useDeletePersonnel();
  const generateInvitation = useGenerateInvitation();

  const [formTarget, setFormTarget] = useState<PersonnelFormTarget | null>(null);
  const [formErrorKey, setFormErrorKey] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Personnel | null>(null);
  const [deleteErrorKey, setDeleteErrorKey] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ token: string; link: string } | null>(null);
  const [inviteErrorKey, setInviteErrorKey] = useState<string | null>(null);

  const personnel = personnelQuery.data ?? [];
  const errorMessage = useErrorMessage(personnelQuery.error, "web.errors.personnel_fetch");

  const openCreate = () => {
    setFormErrorKey(null);
    setFormTarget({ mode: "create" });
  };

  const openEdit = (target: Personnel) => {
    setFormErrorKey(null);
    setFormTarget({ mode: "edit", personnel: target });
  };

  const closeForm = () => {
    setFormTarget(null);
    setFormErrorKey(null);
  };

  const handleSubmit = async (values: PersonnelFormValues) => {
    setFormErrorKey(null);
    try {
      if (formTarget?.mode === "edit") {
        await updatePersonnel.mutateAsync({
          personnelId: formTarget.personnel.id,
          data: toUpdatePersonnelData(values),
        });
        toast(t("web.app.personnel.update_success"), { variant: "success" });
      } else {
        await createPersonnel.mutateAsync(toCreatePersonnelData(values, centerId));
        toast(t("web.app.personnel.create_success"), { variant: "success" });
      }
      closeForm();
    } catch (error) {
      setFormErrorKey(toErrorKey(error, "web.errors.personnel_save"));
    }
  };

  const handleToggle = async (target: Personnel) => {
    try {
      await updatePersonnel.mutateAsync({
        personnelId: target.id,
        data: { isActive: !target.isActive },
      });
      toast(t("web.app.personnel.status_success"), { variant: "success" });
    } catch (error) {
      toast(t(toErrorKey(error, "web.errors.personnel_save")), { variant: "error" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteErrorKey(null);
    try {
      await deletePersonnel.mutateAsync(deleteTarget.id);
      toast(t("web.app.personnel.delete_success"), { variant: "success" });
      setDeleteTarget(null);
    } catch (error) {
      setDeleteErrorKey(toErrorKey(error, "web.errors.personnel_delete"));
    }
  };

  const handleGenerateInvitation = async (values: InvitationFormValues) => {
    setInviteErrorKey(null);
    try {
      const result = await generateInvitation.mutateAsync(values.email.trim());
      setInviteResult(result);
    } catch (error) {
      setInviteErrorKey(toErrorKey(error, "web.errors.personnel_invite"));
    }
  };

  const openInvite = () => {
    setInviteResult(null);
    setInviteErrorKey(null);
    setInviteOpen(true);
  };

  if (centerId <= 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("web.app.personnel.error_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-muted">{t("web.app.personnel.no_center")}</p>
        </CardContent>
      </Card>
    );
  }

  const formDefaults: PersonnelFormValues =
    formTarget?.mode === "edit"
      ? personnelToFormValues(formTarget.personnel)
      : EMPTY_PERSONNEL_FORM;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="ytv-display text-3xl font-bold text-text">{t("web.app.personnel.title")}</h2>
          <p className="text-sm text-text-secondary">
            {t("web.app.personnel.total", { count: personnel.length })}
          </p>
        </div>
        <Button onClick={openCreate} disabled={personnelQuery.isPending}>
          {t("web.app.personnel.new_personnel")}
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-semibold text-text">
              {t("web.app.personnel.invite.banner_title")}
            </span>
            <span className="text-xs text-text-muted">
              {t("web.app.personnel.invite.banner_body")}
            </span>
          </div>
          <Button variant="outline" onClick={openInvite}>
            {t("web.app.personnel.invite.cta")}
          </Button>
        </CardContent>
      </Card>

      {personnelQuery.isPending ? (
        <div
          role="status"
          aria-live="polite"
          aria-label={t("common.loading")}
          className="flex flex-col gap-3"
        >
          <Skeleton className="h-16 w-full" />
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : personnelQuery.isError ? (
        <Card role="alert">
          <CardHeader>
            <CardTitle>{t("web.app.personnel.error_title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-text-muted">{errorMessage}</p>
            <Button
              variant="outline"
              className="self-start"
              onClick={() => void personnelQuery.refetch()}
            >
              {t("common.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : personnel.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <EmptyState
              title={t("web.app.personnel.empty_title")}
              body={t("web.app.personnel.empty_body")}
              actionLabel={t("web.app.personnel.empty_cta")}
              onAction={openCreate}
            />
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {personnel.map((person, index) => (
            <li
              key={person.id}
              data-testid={`personnel-row-${person.id}`}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center ytv-stagger"
              style={{ "--ytv-reveal-delay": `${Math.min(index * 60, 300)}ms` } as CSSProperties}
            >
              <span
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card2 text-sm font-bold text-text"
              >
                {initialsOf(person)}
              </span>

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-text">
                    {`${person.firstName} ${person.lastName}`.trim()}
                  </span>
                  <Badge variant={person.isActive ? "success" : "default"}>
                    {person.isActive ? t("common.active") : t("common.inactive")}
                  </Badge>
                </div>
                <span className="truncate text-xs text-text-muted">{person.email}</span>
                {person.phone ? (
                  <span className="text-xs text-text-muted">{person.phone}</span>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openEdit(person)}
                  aria-label={t("web.app.personnel.actions.edit_aria", {
                    name: `${person.firstName} ${person.lastName}`.trim(),
                  })}
                >
                  {t("web.app.personnel.actions.edit")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void handleToggle(person)}
                  aria-label={t(
                    person.isActive
                      ? "web.app.personnel.actions.deactivate_aria"
                      : "web.app.personnel.actions.activate_aria",
                    { name: `${person.firstName} ${person.lastName}`.trim() },
                  )}
                >
                  {person.isActive
                    ? t("web.app.personnel.actions.deactivate")
                    : t("web.app.personnel.actions.activate")}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    setDeleteErrorKey(null);
                    setDeleteTarget(person);
                  }}
                  aria-label={t("web.app.personnel.actions.delete_aria", {
                    name: `${person.firstName} ${person.lastName}`.trim(),
                  })}
                >
                  {t("web.app.personnel.actions.delete")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {formTarget ? (
        <PersonnelFormModal
          mode={formTarget.mode}
          defaultValues={formDefaults}
          saving={createPersonnel.isPending || updatePersonnel.isPending}
          errorKey={formErrorKey}
          onClose={closeForm}
          onSubmit={(values) => void handleSubmit(values)}
        />
      ) : null}

      {inviteOpen ? (
        <InvitationModal
          result={inviteResult}
          generating={generateInvitation.isPending}
          errorKey={inviteErrorKey}
          onClose={() => setInviteOpen(false)}
          onGenerate={(values) => void handleGenerateInvitation(values)}
        />
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("web.app.personnel.delete_title")}
        description={
          deleteTarget
            ? t("web.app.personnel.delete_body", {
                name: `${deleteTarget.firstName} ${deleteTarget.lastName}`.trim(),
              })
            : undefined
        }
        confirmLabel={t("web.app.personnel.delete_confirm")}
        cancelLabel={t("common.cancel")}
        closeLabel={t("common.close")}
        loading={deletePersonnel.isPending}
        error={deleteErrorKey}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
