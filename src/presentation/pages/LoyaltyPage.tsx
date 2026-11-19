import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AdminLoyaltyProgram, AdminLoyaltySettings } from "yotuvia-core";
import { LoyaltyProgramFormModal, LoyaltySettingsForm } from "@/presentation/components/loyalty";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Select,
  Skeleton,
  useToast,
} from "@/presentation/components/ui";
import type { BadgeVariant } from "@/presentation/components/ui";
import { useAdminCenter } from "@/presentation/hooks/use-admin-center";
import { useAuthSession } from "@/presentation/hooks/use-auth-session";
import { useCenterClients } from "@/presentation/hooks/use-clients";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import {
  useClientLoyaltyCards,
  useCreateLoyaltyProgram,
  useDeleteLoyaltyProgram,
  useLoyaltyMetrics,
  useLoyaltyPrograms,
  useLoyaltySettings,
  useToggleLoyaltyProgram,
  useUpdateLoyaltyProgram,
  useUpdateLoyaltySettings,
} from "@/presentation/hooks/use-loyalty";
import { useServices } from "@/presentation/hooks/use-services";
import { toErrorKey, useErrorMessage } from "@/presentation/lib/errors";
import {
  EMPTY_LOYALTY_PROGRAM_FORM,
  loyaltyProgramToFormValues,
  toLoyaltyProgramInput,
} from "@/presentation/schemas/loyalty.schemas";
import type { LoyaltyProgramFormValues } from "@/presentation/schemas/loyalty.schemas";

/** One page of clients offered by the punch-card selector (API max page size). */
const CLIENT_OPTIONS_LIMIT = 100;

const NO_CLIENT = 0;

type ProgramFormTarget = { mode: "create" } | { mode: "edit"; program: AdminLoyaltyProgram };

const CARD_STATUS_META: Readonly<Record<string, { key: string; variant: BadgeVariant }>> = {
  active: { key: "web.app.loyalty.cards.status.active", variant: "info" },
  completed: { key: "web.app.loyalty.cards.status.completed", variant: "success" },
};

/**
 * Owner loyalty section: programs (stamps → reward), center settings and the
 * punch cards a client has collected.
 *
 * The whole surface maps to `data/sources/admin-api.ts` functions (see
 * `use-loyalty.ts` for why there is no repository seam). Notable contract
 * facts baked into the UI:
 * - `UpdateLoyaltyProgramRequest` has no `is_active`, so activation is a
 *   dedicated toggle action rather than a form field.
 * - `GET /loyalty/client/:clientId` does not populate `service_name`, so a
 *   card is labelled by its program's service id fallback.
 * - The client selector loads a single page (100 rows, the API maximum) because
 *   the client list exposes no search; when the center has more, the UI says so
 *   instead of pretending the list is complete.
 */
export function LoyaltyPage() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t("web.app.loyalty.meta.title"));

  const { user } = useAuthSession();
  const centerId = Number(user?.id ?? 0);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const { toast } = useToast();

  const [formTarget, setFormTarget] = useState<ProgramFormTarget | null>(null);
  const [formErrorKey, setFormErrorKey] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminLoyaltyProgram | null>(null);
  const [deleteErrorKey, setDeleteErrorKey] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<number>(NO_CLIENT);

  const centerQuery = useAdminCenter(centerId);
  const programsQuery = useLoyaltyPrograms(centerId);
  const settingsQuery = useLoyaltySettings(centerId);
  const servicesQuery = useServices(centerId, language);
  const clientsQuery = useCenterClients(centerId, 1, CLIENT_OPTIONS_LIMIT);
  const cardsQuery = useClientLoyaltyCards(selectedClientId);
  const metricsQuery = useLoyaltyMetrics(centerId);

  const createProgram = useCreateLoyaltyProgram();
  const updateProgram = useUpdateLoyaltyProgram();
  const deleteProgram = useDeleteLoyaltyProgram();
  const toggleProgram = useToggleLoyaltyProgram();
  const updateSettings = useUpdateLoyaltySettings();

  const programsError = useErrorMessage(programsQuery.error, "web.errors.loyalty_fetch");
  const settingsError = useErrorMessage(settingsQuery.error, "web.errors.loyalty_fetch");
  const cardsError = useErrorMessage(cardsQuery.error, "web.errors.loyalty_fetch");

  const programs = useMemo(() => programsQuery.data ?? [], [programsQuery.data]);
  const services = useMemo(() => servicesQuery.data ?? [], [servicesQuery.data]);
  const clients = useMemo(() => clientsQuery.data?.data ?? [], [clientsQuery.data]);
  const clientsTotal = clientsQuery.data?.total ?? 0;
  const cards = useMemo(() => cardsQuery.data ?? [], [cardsQuery.data]);
  const metrics = useMemo(() => metricsQuery.data ?? [], [metricsQuery.data]);

  const anyService = t("web.app.loyalty.any_service");
  const programTitle = (program: AdminLoyaltyProgram): string =>
    program.service_name?.trim() ? program.service_name : anyService;

  const handleSubmitProgram = async (values: LoyaltyProgramFormValues) => {
    setFormErrorKey(null);
    try {
      const input = toLoyaltyProgramInput(values);
      if (formTarget?.mode === "edit") {
        await updateProgram.mutateAsync({ programId: formTarget.program.id, ...input });
        toast(t("web.app.loyalty.update_success"), { variant: "success" });
      } else {
        await createProgram.mutateAsync({ centerId, ...input });
        toast(t("web.app.loyalty.create_success"), { variant: "success" });
      }
      setFormTarget(null);
    } catch (error) {
      setFormErrorKey(toErrorKey(error, "web.errors.loyalty_save"));
    }
  };

  const handleToggleProgram = async (program: AdminLoyaltyProgram) => {
    try {
      await toggleProgram.mutateAsync({ programId: program.id, isActive: !program.is_active });
      toast(t("web.app.loyalty.toggle_success"), { variant: "success" });
    } catch (error) {
      toast(t(toErrorKey(error, "web.errors.loyalty_save")), { variant: "error" });
    }
  };

  const handleDeleteProgram = async () => {
    if (!deleteTarget) return;
    setDeleteErrorKey(null);
    try {
      await deleteProgram.mutateAsync(deleteTarget.id);
      toast(t("web.app.loyalty.delete_success"), { variant: "success" });
      setDeleteTarget(null);
    } catch (error) {
      setDeleteErrorKey(toErrorKey(error, "web.errors.loyalty_delete"));
    }
  };

  const handleSaveSettings = async (data: Partial<AdminLoyaltySettings>) => {
    try {
      await updateSettings.mutateAsync({ centerId, data });
      toast(t("web.app.loyalty.settings.save_success"), { variant: "success" });
    } catch (error) {
      toast(t(toErrorKey(error, "web.errors.loyalty_settings")), { variant: "error" });
    }
  };

  if (centerId <= 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("web.app.loyalty.error_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-muted">{t("web.app.loyalty.no_center")}</p>
        </CardContent>
      </Card>
    );
  }

  const formDefaults: LoyaltyProgramFormValues =
    formTarget?.mode === "edit"
      ? loyaltyProgramToFormValues(formTarget.program)
      : EMPTY_LOYALTY_PROGRAM_FORM;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="ytv-display text-3xl font-bold text-text">{t("web.app.loyalty.title")}</h2>
        <p className="text-sm text-text-secondary">
          {centerQuery.data?.name
            ? t("web.app.loyalty.subtitle", { center: centerQuery.data.name })
            : t("web.app.loyalty.subtitle_plain")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("web.app.loyalty.settings.title")}</CardTitle>
          <CardDescription>{t("web.app.loyalty.settings.body")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {settingsQuery.isPending ? (
            <Skeleton className="h-10 w-56" />
          ) : settingsQuery.isError ? (
            <div role="alert" className="flex flex-col items-start gap-3">
              <p className="text-sm text-text-muted">{settingsError}</p>
              <Button variant="outline" onClick={() => void settingsQuery.refetch()}>
                {t("common.retry")}
              </Button>
            </div>
          ) : settingsQuery.data ? (
            <LoyaltySettingsForm
              settings={settingsQuery.data}
              saving={updateSettings.isPending}
              onSave={(data) => void handleSaveSettings(data)}
            />
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold text-text">{t("web.app.loyalty.programs.title")}</h3>
          <p className="text-sm text-text-secondary">
            {t("web.app.loyalty.programs.total", { count: programs.length })}
          </p>
        </div>
        <Button
          onClick={() => {
            setFormErrorKey(null);
            setFormTarget({ mode: "create" });
          }}
          disabled={programsQuery.isPending}
        >
          {t("web.app.loyalty.programs.new")}
        </Button>
      </div>

      {programsQuery.isPending ? (
        <div
          role="status"
          aria-live="polite"
          aria-label={t("common.loading")}
          className="flex flex-col gap-3"
        >
          {Array.from({ length: 2 }, (_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : programsQuery.isError ? (
        <Card role="alert">
          <CardHeader>
            <CardTitle>{t("web.app.loyalty.programs.error_title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-text-muted">{programsError}</p>
            <Button
              variant="outline"
              className="self-start"
              onClick={() => void programsQuery.refetch()}
            >
              {t("common.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : programs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-base font-semibold text-text">
              {t("web.app.loyalty.programs.empty_title")}
            </p>
            <p className="text-sm text-text-muted">{t("web.app.loyalty.programs.empty_body")}</p>
            <Button
              onClick={() => {
                setFormErrorKey(null);
                setFormTarget({ mode: "create" });
              }}
            >
              {t("web.app.loyalty.programs.empty_cta")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {programs.map((program) => {
            const title = programTitle(program);
            const reward =
              program.reward_type === "percentage_discount"
                ? t("web.app.loyalty.reward_percentage", { value: program.discount_value })
                : t("web.app.loyalty.reward_free");
            return (
              <li
                key={program.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-text">{title}</span>
                    <Badge variant={program.is_active ? "success" : "default"}>
                      {program.is_active ? t("common.active") : t("common.inactive")}
                    </Badge>
                  </div>
                  <span className="text-xs text-text-muted">
                    {t("web.app.loyalty.programs.steps", { count: program.required_steps })}
                    {" · "}
                    {reward}
                    {" · "}
                    {program.duration_days
                      ? t("web.app.loyalty.programs.duration", { days: program.duration_days })
                      : t("web.app.loyalty.programs.no_duration")}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setFormErrorKey(null);
                      setFormTarget({ mode: "edit", program });
                    }}
                    aria-label={t("web.app.loyalty.programs.actions.edit_aria", { name: title })}
                  >
                    {t("web.app.loyalty.programs.actions.edit")}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleToggleProgram(program)}
                    aria-label={t(
                      program.is_active
                        ? "web.app.loyalty.programs.actions.deactivate_aria"
                        : "web.app.loyalty.programs.actions.activate_aria",
                      { name: title },
                    )}
                  >
                    {program.is_active
                      ? t("web.app.loyalty.programs.actions.deactivate")
                      : t("web.app.loyalty.programs.actions.activate")}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      setDeleteErrorKey(null);
                      setDeleteTarget(program);
                    }}
                    aria-label={t("web.app.loyalty.programs.actions.delete_aria", { name: title })}
                  >
                    {t("web.app.loyalty.programs.actions.delete")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("web.app.loyalty.metrics.title")}</CardTitle>
          <CardDescription>{t("web.app.loyalty.metrics.body")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {metricsQuery.isPending ? (
            <Skeleton className="h-16 w-full" />
          ) : metricsQuery.isError ? (
            <div role="alert" className="flex flex-col items-start gap-3">
              <p className="text-sm text-text-muted">
                {t("web.errors.loyalty_fetch")}
              </p>
              <Button variant="outline" onClick={() => void metricsQuery.refetch()}>
                {t("common.retry")}
              </Button>
            </div>
          ) : metrics.length === 0 ? (
            <p className="text-sm text-text-muted">{t("web.app.loyalty.metrics.empty")}</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-text-secondary">
                  <th className="py-2 pr-4 font-medium">{t("web.app.loyalty.metrics.program")}</th>
                  <th className="py-2 pr-4 font-medium">{t("web.app.loyalty.metrics.active")}</th>
                  <th className="py-2 pr-4 font-medium">{t("web.app.loyalty.metrics.completed")}</th>
                  <th className="py-2 pr-4 font-medium">{t("web.app.loyalty.metrics.redemptions")}</th>
                  <th className="py-2 font-medium">{t("web.app.loyalty.metrics.rate")}</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((row) => (
                  <tr key={row.program_id} className="border-t border-border">
                    <td className="py-2 pr-4 text-text">
                      {row.service_name?.trim() ? row.service_name : anyService}
                    </td>
                    <td className="py-2 pr-4 text-text-muted">{row.active_cards}</td>
                    <td className="py-2 pr-4 text-text-muted">{row.completed_cards}</td>
                    <td className="py-2 pr-4 text-text-muted">{row.redemptions}</td>
                    <td className="py-2 text-text-muted">
                      {t("web.app.loyalty.metrics.rate_value", {
                        percent: Math.round(row.redemption_rate * 100),
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("web.app.loyalty.cards.title")}</CardTitle>
          <CardDescription>{t("web.app.loyalty.cards.body")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="w-full sm:w-80">
            <Select
              label={t("web.app.loyalty.cards.client")}
              value={String(selectedClientId)}
              onChange={(event) => setSelectedClientId(Number(event.target.value))}
              disabled={clientsQuery.isPending}
            >
              <option value={NO_CLIENT}>{t("web.app.loyalty.cards.client_placeholder")}</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {`${client.firstName} ${client.lastName}`.trim() || client.email}
                </option>
              ))}
            </Select>
          </div>

          {clientsTotal > clients.length ? (
            <p className="text-xs text-text-muted">
              {t("web.app.loyalty.cards.limited", {
                shown: clients.length,
                total: clientsTotal,
              })}
            </p>
          ) : null}

          {selectedClientId === NO_CLIENT ? null : cardsQuery.isPending ? (
            <div
              role="status"
              aria-live="polite"
              aria-label={t("common.loading")}
              className="flex flex-col gap-3"
            >
              <Skeleton className="h-16 w-full" />
            </div>
          ) : cardsQuery.isError ? (
            <div role="alert" className="flex flex-col items-start gap-3">
              <p className="text-sm text-text-muted">{cardsError}</p>
              <Button variant="outline" onClick={() => void cardsQuery.refetch()}>
                {t("common.retry")}
              </Button>
            </div>
          ) : cards.length === 0 ? (
            <p className="text-sm text-text-muted">{t("web.app.loyalty.cards.empty")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {cards.map((card) => {
                const meta = CARD_STATUS_META[card.status] ?? {
                  key: "web.app.loyalty.cards.status.unknown",
                  variant: "default" as const,
                };
                return (
                  <li
                    key={card.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-4"
                  >
                    <span className="min-w-0 flex-1 text-sm font-semibold text-text">
                      {card.loyalty_program.service_name?.trim()
                        ? card.loyalty_program.service_name
                        : anyService}
                    </span>
                    <span className="text-xs text-text-muted">
                      {t("web.app.loyalty.cards.steps", {
                        current: card.current_steps,
                        target: card.loyalty_program.required_steps,
                      })}
                    </span>
                    <Badge variant={meta.variant}>{t(meta.key)}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {formTarget ? (
        <LoyaltyProgramFormModal
          mode={formTarget.mode}
          defaultValues={formDefaults}
          services={services}
          saving={createProgram.isPending || updateProgram.isPending}
          errorKey={formErrorKey}
          onClose={() => {
            setFormTarget(null);
            setFormErrorKey(null);
          }}
          onSubmit={(values) => void handleSubmitProgram(values)}
        />
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("web.app.loyalty.programs.delete_title")}
        description={
          deleteTarget
            ? t("web.app.loyalty.programs.delete_body", { name: programTitle(deleteTarget) })
            : undefined
        }
        confirmLabel={t("web.app.loyalty.programs.delete_confirm")}
        cancelLabel={t("common.cancel")}
        closeLabel={t("common.close")}
        loading={deleteProgram.isPending}
        error={deleteErrorKey}
        onConfirm={() => void handleDeleteProgram()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
