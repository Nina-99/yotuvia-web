import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { AdminPromotion } from "yotuvia-core";

import { PromotionFormModal } from "@/presentation/components/promotions";
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
import type { BadgeVariant } from "@/presentation/components/ui";
import { useAdminCenter } from "@/presentation/hooks/use-admin-center";
import { useAuthSession } from "@/presentation/hooks/use-auth-session";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import {
  useCreatePromotion,
  useDeletePromotion,
  usePromotions,
  useTogglePromotion,
  useUpdatePromotion,
} from "@/presentation/hooks/use-promotions";
import { useServices } from "@/presentation/hooks/use-services";
import { dateKeyFromApi } from "@/presentation/lib/dates";
import { toErrorKey, useErrorMessage } from "@/presentation/lib/errors";
import { formatCurrency, formatDate, formatNumber } from "@/presentation/lib/format";
import {
  EMPTY_PROMOTION_FORM,
  promotionToFormValues,
  toPromotionInput,
} from "@/presentation/schemas/promotion.schemas";
import type { PromotionFormValues } from "@/presentation/schemas/promotion.schemas";

type FormTarget = { mode: "create" } | { mode: "edit"; promotion: AdminPromotion };

const TARGET_KEY_SUFFIX: Readonly<Record<AdminPromotion["target_clients"], string>> = {
  all: "all",
  new: "new",
  inactive: "inactive",
};

const TARGET_VARIANT: Readonly<Record<AdminPromotion["target_clients"], BadgeVariant>> = {
  all: "default",
  new: "info",
  inactive: "warning",
};

/** Human-readable discount/reward phrase for a promotion. */
function promotionReward(
  promotion: AdminPromotion,
  language: string,
  currency: string,
  t: TFunction,
): string {
  switch (promotion.type) {
    case "percentage":
      return t("web.app.promotions.reward_percentage", {
        value: formatNumber(promotion.discount_value, language),
      });
    case "fixed_amount":
      return t("web.app.promotions.reward_fixed", {
        value: formatCurrency(promotion.discount_value, language, currency),
      });
    case "buy_x_get_y":
      return t("web.app.promotions.reward_buy_get", {
        x: promotion.buy_x_count,
        y: promotion.buy_y_count,
      });
    default:
      return t("web.app.promotions.reward_unknown");
  }
}

/** Localized validity window, or `null` when the promotion has no bounds. */
function promotionValidity(
  promotion: AdminPromotion,
  language: string,
  t: TFunction,
): string | null {
  const from = promotion.valid_from
    ? formatDate(dateKeyFromApi(promotion.valid_from), language)
    : null;
  const to = promotion.valid_to ? formatDate(dateKeyFromApi(promotion.valid_to), language) : null;

  if (from !== null && to !== null) {
    return t("web.app.promotions.validity_range", { from, to });
  }
  if (from !== null) return t("web.app.promotions.validity_from", { from });
  if (to !== null) return t("web.app.promotions.validity_to", { to });
  return null;
}

/** Redemption counter, treating `max_redemptions = 0` as unlimited. */
function promotionRedemptions(promotion: AdminPromotion, language: string, t: TFunction): string {
  const current = formatNumber(promotion.current_redemptions, language);
  if (promotion.max_redemptions <= 0) {
    return t("web.app.promotions.redemptions_unlimited", { current });
  }
  return t("web.app.promotions.redemptions", {
    current,
    max: formatNumber(promotion.max_redemptions, language),
  });
}

/**
 * Owner promotions section: create/edit/activate/delete center promotions.
 *
 * The whole surface maps to `data/sources/admin-api.ts` functions (see
 * `use-promotions.ts` for why there is no repository seam). Notable contract
 * facts baked into the UI:
 * - `GET /promotions/center/:centerId` is inactive-excluding by default, so the
 *   "show inactive" switch flips the query's `include_inactive` flag.
 * - `PUT /promotions/:id` carries `is_active`, so activate/deactivate reuses the
 *   partial update payload.
 * - `CreatePromotionRequest` always requires `buy_x_count` / `buy_y_count` to be
 *   `>= 1` (Go `min=1`, no `omitempty`), which the schema/`toPromotionInput`
 *   guarantee for every type.
 *
 * SECURITY: the API endpoints behind this page are JWT-only — no role gate and
 * no center-ownership check — so this UI correctly scopes reads to the owner's
 * center but the backend would still accept cross-center ids from any token.
 * Reported, not fixed, in this work unit.
 */
export function PromotionsPage() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t("web.app.promotions.meta.title"));

  const { user } = useAuthSession();
  const centerId = Number(user?.id ?? 0);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const { toast } = useToast();

  const [includeInactive, setIncludeInactive] = useState(false);
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [formErrorKey, setFormErrorKey] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminPromotion | null>(null);
  const [deleteErrorKey, setDeleteErrorKey] = useState<string | null>(null);

  const centerQuery = useAdminCenter(centerId);
  const servicesQuery = useServices(centerId, language);
  const promotionsQuery = usePromotions(centerId, includeInactive);

  const createPromotion = useCreatePromotion();
  const updatePromotion = useUpdatePromotion();
  const deletePromotion = useDeletePromotion();
  const togglePromotion = useTogglePromotion();

  const promotions = useMemo(() => promotionsQuery.data ?? [], [promotionsQuery.data]);
  const services = useMemo(() => servicesQuery.data ?? [], [servicesQuery.data]);
  const currency = centerQuery.data?.currency ?? "USD";
  const errorMessage = useErrorMessage(promotionsQuery.error, "web.errors.promotions_fetch");

  const handleSubmit = async (values: PromotionFormValues) => {
    setFormErrorKey(null);
    try {
      const input = toPromotionInput(values);
      if (formTarget?.mode === "edit") {
        await updatePromotion.mutateAsync({ promotionId: formTarget.promotion.id, ...input });
        toast(t("web.app.promotions.update_success"), { variant: "success" });
      } else {
        await createPromotion.mutateAsync({ centerId, ...input });
        toast(t("web.app.promotions.create_success"), { variant: "success" });
      }
      setFormTarget(null);
    } catch (error) {
      setFormErrorKey(toErrorKey(error, "web.errors.promotions_save"));
    }
  };

  const handleToggle = async (promotion: AdminPromotion) => {
    try {
      await togglePromotion.mutateAsync({
        promotionId: promotion.id,
        isActive: !promotion.is_active,
      });
      toast(t("web.app.promotions.toggle_success"), { variant: "success" });
    } catch (error) {
      toast(t(toErrorKey(error, "web.errors.promotions_save")), { variant: "error" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteErrorKey(null);
    try {
      await deletePromotion.mutateAsync(deleteTarget.id);
      toast(t("web.app.promotions.delete_success"), { variant: "success" });
      setDeleteTarget(null);
    } catch (error) {
      setDeleteErrorKey(toErrorKey(error, "web.errors.promotions_delete"));
    }
  };

  if (centerId <= 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("web.app.promotions.error_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-muted">{t("web.app.promotions.no_center")}</p>
        </CardContent>
      </Card>
    );
  }

  const formDefaults: PromotionFormValues =
    formTarget?.mode === "edit"
      ? promotionToFormValues(formTarget.promotion)
      : EMPTY_PROMOTION_FORM;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="ytv-display text-3xl font-bold text-text">{t("web.app.promotions.title")}</h2>
        <p className="text-sm text-text-secondary">
          {centerQuery.data?.name
            ? t("web.app.promotions.subtitle", { center: centerQuery.data.name })
            : t("web.app.promotions.subtitle_plain")}
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold text-text">
            {t("web.app.promotions.list.title")}
          </h3>
          <p className="text-sm text-text-secondary">
            {t("web.app.promotions.list.total", { count: promotions.length })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
              className="h-4 w-4 rounded border-border accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            {t("web.app.promotions.list.show_inactive")}
          </label>
          <Button
            onClick={() => {
              setFormErrorKey(null);
              setFormTarget({ mode: "create" });
            }}
            disabled={promotionsQuery.isPending}
          >
            {t("web.app.promotions.list.new")}
          </Button>
        </div>
      </div>

      {promotionsQuery.isPending ? (
        <div
          role="status"
          aria-live="polite"
          aria-label={t("common.loading")}
          className="flex flex-col gap-3"
        >
          {Array.from({ length: 2 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      ) : promotionsQuery.isError ? (
        <Card role="alert">
          <CardHeader>
            <CardTitle>{t("web.app.promotions.list.error_title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-text-muted">{errorMessage}</p>
            <Button
              variant="outline"
              className="self-start"
              onClick={() => void promotionsQuery.refetch()}
            >
              {t("common.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : promotions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <EmptyState
              title={t("web.app.promotions.list.empty_title")}
              body={t("web.app.promotions.list.empty_body")}
              actionLabel={t("web.app.promotions.list.empty_cta")}
              onAction={() => {
                setFormErrorKey(null);
                setFormTarget({ mode: "create" });
              }}
            />
            {includeInactive ? null : (
              <p className="text-xs text-text-muted">
                {t("web.app.promotions.list.empty_hint_inactive")}
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {promotions.map((promotion) => {
            const validity = promotionValidity(promotion, language, t);
            const serviceName = promotion.service_name?.trim();
            return (
              <li
                key={promotion.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-text">{promotion.name}</span>
                      <Badge variant={promotion.is_active ? "success" : "default"}>
                        {promotion.is_active ? t("common.active") : t("common.inactive")}
                      </Badge>
                      <Badge variant={TARGET_VARIANT[promotion.target_clients]}>
                        {t(`web.app.promotions.target.${TARGET_KEY_SUFFIX[promotion.target_clients]}`)}
                      </Badge>
                    </div>
                    {promotion.description ? (
                      <p className="text-sm text-text-muted">{promotion.description}</p>
                    ) : null}
                    <span className="text-xs text-text-muted">
                      {promotionReward(promotion, language, currency, t)}
                      {" · "}
                      {serviceName ? serviceName : t("web.app.promotions.any_service")}
                      {" · "}
                      {promotionRedemptions(promotion, language, t)}
                    </span>
                    {validity ? (
                      <span className="text-xs text-text-muted">{validity}</span>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setFormErrorKey(null);
                        setFormTarget({ mode: "edit", promotion });
                      }}
                      aria-label={t("web.app.promotions.list.actions.edit_aria", {
                        name: promotion.name,
                      })}
                    >
                      {t("web.app.promotions.list.actions.edit")}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void handleToggle(promotion)}
                      aria-label={t(
                        promotion.is_active
                          ? "web.app.promotions.list.actions.deactivate_aria"
                          : "web.app.promotions.list.actions.activate_aria",
                        { name: promotion.name },
                      )}
                    >
                      {promotion.is_active
                        ? t("web.app.promotions.list.actions.deactivate")
                        : t("web.app.promotions.list.actions.activate")}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        setDeleteErrorKey(null);
                        setDeleteTarget(promotion);
                      }}
                      aria-label={t("web.app.promotions.list.actions.delete_aria", {
                        name: promotion.name,
                      })}
                    >
                      {t("web.app.promotions.list.actions.delete")}
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {formTarget ? (
        <PromotionFormModal
          mode={formTarget.mode}
          defaultValues={formDefaults}
          services={services}
          saving={createPromotion.isPending || updatePromotion.isPending}
          errorKey={formErrorKey}
          onClose={() => setFormTarget(null)}
          onSubmit={(values) => void handleSubmit(values)}
        />
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("web.app.promotions.list.delete_title")}
        description={
          deleteTarget
            ? t("web.app.promotions.list.delete_body", { name: deleteTarget.name })
            : undefined
        }
        confirmLabel={t("web.app.promotions.list.delete_confirm")}
        cancelLabel={t("common.cancel")}
        closeLabel={t("common.close")}
        loading={deletePromotion.isPending}
        error={deleteErrorKey}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
