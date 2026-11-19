import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { imageUrl } from "yotuvia-core";

import { PaymentTiersFields } from "@/presentation/components/profile/PaymentTiersFields";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
  Skeleton,
  useToast,
} from "@/presentation/components/ui";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import {
  usePlatformCenters,
  usePlatformPaymentConfig,
  useUpdatePlatformPaymentConfig,
  useUploadPlatformPaymentQr,
} from "@/presentation/hooks/use-platform";
import { toErrorKey, useErrorMessage } from "@/presentation/lib/errors";
import { toPaymentTiersPayload } from "@/presentation/schemas/profile.schemas";
import type { PaymentConfigFormValues } from "@/presentation/schemas/profile.schemas";

const QR_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

/** DOM id of this surface's form; the centre profile uses its own. */
const FORM_ID = "platform-payment-config-form";

/**
 * Platform centres: pick a centre and manage its TOKEN-payment configuration.
 *
 * PRODUCT CONSTRAINT: payments settle ONLY in Ytv tokens. There is no
 * payment gateway — the QR below is the transfer QR customers scan to send the
 * amount, which the platform admin then validates in the payments queue. The
 * copy says so explicitly.
 *
 * WHY THE CENTRE-SCOPED `PaymentConfigForm` IS NOT REUSED VERBATIM:
 * that component's hooks (`usePaymentConfig`, `useUpdatePaymentConfig`,
 * `useUploadPaymentQr`) hit the CENTRE-scoped routes, which resolve the centre
 * from the JWT `centerID` claim — a platform admin has no such claim, and the
 * platform routes name the centre in the PATH
 * (`/admin/platform/centers/:centerId/payment[/qr]`). Reusing it would either
 * need the centre-scoped endpoints (403 for this role) or a prop drilling a
 * second endpoint into a component named after the profile surface. Instead the
 * SHARED, endpoint-agnostic half is reused: the extracted
 * `PaymentTiersFields` (phone + tier ladder) and the zod schema/mappers in
 * `schemas/profile.schemas.ts`, so validation and payload shape exist once.
 *
 * Data notes (verified against `yotuvia-api`, not assumed):
 * - `GET admin/platform/centers` is the only centre NAME source; both the picker
 *   and the queue's name resolution come from it.
 * - The read mirrors the public per-centre payload keyed by the path centre, so
 *   a missing centre answers 404 instead of serving another one's config.
 * - `PUT .../payment` replaces the whole tier ladder when non-empty and ignores
 *   an empty phone, exactly like the centre-scoped update.
 */
export function PlatformCentersPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("web.app.platform.centers.meta_title"));
  const { toast } = useToast();

  const centersQuery = usePlatformCenters();
  const [chosenCenterId, setChosenCenterId] = useState(0);

  const centers = centersQuery.data ?? [];
  // Derive the effective selection instead of syncing it in an effect: `0` means
  // "no explicit choice yet", so the first centre is shown without any state
  // write as soon as the list arrives.
  const effectiveCenterId = chosenCenterId > 0 ? chosenCenterId : (centers[0]?.id ?? 0);
  const selectedCenter = centers.find((center) => center.id === effectiveCenterId) ?? null;
  // A stored centre name can be blank (verified live), so the title uses the
  // readable id form instead of rendering nothing.
  const selectedCenterName =
    selectedCenter === null
      ? null
      : selectedCenter.name.trim() !== ""
        ? selectedCenter.name
        : t("web.app.platform.centers.unnamed_center", { id: selectedCenter.id });

  const configQuery = usePlatformPaymentConfig(effectiveCenterId);
  const updateConfig = useUpdatePlatformPaymentConfig();
  const uploadQr = useUploadPlatformPaymentQr();

  const fileRef = useRef<HTMLInputElement>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [uploadErrorKey, setUploadErrorKey] = useState<string | null>(null);

  const centersError = useErrorMessage(centersQuery.error, "web.errors.platform_centers_fetch");
  const configError = useErrorMessage(configQuery.error, "web.errors.platform_payment_fetch");

  const handleSubmit = async (values: PaymentConfigFormValues) => {
    if (effectiveCenterId <= 0) return;
    setErrorKey(null);
    try {
      await updateConfig.mutateAsync({
        centerId: effectiveCenterId,
        paymentPhone: values.paymentPhone.trim(),
        tiers: toPaymentTiersPayload(values.tiers),
      });
      toast(t("web.app.platform.centers.save_success"), { variant: "success" });
    } catch (error) {
      setErrorKey(toErrorKey(error, "web.errors.platform_payment_save"));
    }
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || effectiveCenterId <= 0) return;
    setUploadErrorKey(null);
    try {
      await uploadQr.mutateAsync({ centerId: effectiveCenterId, file });
      toast(t("web.app.platform.centers.upload_success"), { variant: "success" });
    } catch (error) {
      setUploadErrorKey(toErrorKey(error, "web.errors.platform_payment_upload"));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const currentQr = configQuery.data?.payment_qr_url;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="ytv-display text-3xl font-bold text-text">{t("web.app.platform.centers.title")}</h2>
        <p className="text-sm text-text-secondary">{t("web.app.platform.centers.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("web.app.platform.centers.picker_title")}</CardTitle>
          <CardDescription>{t("web.app.platform.centers.picker_body")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {centersQuery.isPending ? (
            <div
              role="status"
              aria-live="polite"
              aria-label={t("common.loading")}
              className="flex flex-col gap-3"
            >
              <Skeleton className="h-10 w-full sm:w-80" />
            </div>
          ) : centersQuery.isError ? (
            <div role="alert" className="flex flex-col items-start gap-3">
              <p className="text-sm text-text-muted">{centersError}</p>
              <Button variant="outline" onClick={() => void centersQuery.refetch()}>
                {t("common.retry")}
              </Button>
            </div>
          ) : centers.length === 0 ? (
            <p className="text-sm text-text-muted">{t("web.app.platform.centers.empty")}</p>
          ) : (
            <div className="w-full sm:max-w-md">
              <Select
                label={t("web.app.platform.centers.picker_label")}
                value={String(effectiveCenterId)}
                onChange={(event) => {
                  setChosenCenterId(Number(event.target.value));
                  setErrorKey(null);
                  setUploadErrorKey(null);
                }}
              >
                {centers.map((center) => (
                  <option key={center.id} value={String(center.id)}>
                    {center.name.trim() !== ""
                      ? center.name
                      : t("web.app.platform.centers.unnamed_center", { id: center.id })}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {effectiveCenterId > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedCenterName
                ? t("web.app.platform.centers.config_title", { center: selectedCenterName })
                : t("web.app.platform.centers.config_title_plain")}
            </CardTitle>
            <CardDescription>{t("web.app.platform.centers.config_body")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-xs text-text-muted">{t("web.app.platform.centers.qr_explainer")}</p>

            {configQuery.isPending ? (
              <div
                role="status"
                aria-live="polite"
                aria-label={t("common.loading")}
                className="flex flex-col gap-3"
              >
                <Skeleton className="h-32 w-full" />
              </div>
            ) : configQuery.isError ? (
              <div role="alert" className="flex flex-col items-start gap-3">
                <p className="text-sm text-text-muted">{configError}</p>
                <Button variant="outline" onClick={() => void configQuery.refetch()}>
                  {t("common.retry")}
                </Button>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <h4 className="text-sm font-semibold text-text">
                    {t("web.app.platform.centers.qr_title")}
                  </h4>
                  {currentQr ? (
                    <img
                      src={imageUrl(currentQr)}
                      alt={t("web.app.platform.centers.qr_alt")}
                      className="h-40 w-40 rounded-lg border border-border bg-card2 object-contain p-2"
                    />
                  ) : (
                    <p className="text-sm text-text-muted">
                      {t("web.app.platform.centers.qr_empty")}
                    </p>
                  )}

                  <label htmlFor="platform-payment-qr-file" className="text-sm font-medium text-text">
                    {t("web.app.profile.payments.qr_upload")}
                  </label>
                  <input
                    id="platform-payment-qr-file"
                    ref={fileRef}
                    type="file"
                    accept={QR_ACCEPT}
                    onChange={(event) => void handleUpload(event)}
                    aria-describedby="platform-payment-qr-hint"
                    className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-input-text file:mr-3 file:rounded-md file:border-0 file:bg-card2 file:px-3 file:py-1 file:text-text focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <p id="platform-payment-qr-hint" className="text-xs text-text-muted">
                    {t("web.app.profile.payments.qr_hint")}
                  </p>
                  {uploadQr.isPending ? (
                    <p role="status" className="text-xs text-text-muted">
                      {t("common.saving")}
                    </p>
                  ) : null}
                  {uploadErrorKey ? (
                    <p role="alert" className="text-xs text-danger">
                      {t(uploadErrorKey, { defaultValue: uploadErrorKey })}
                    </p>
                  ) : null}
                </div>

                <PaymentTiersFields
                  // Remount per centre so the draft re-seeds from that centre's
                  // payload; the form is deliberately uncontrolled between saves.
                  key={effectiveCenterId}
                  config={configQuery.data}
                  saving={updateConfig.isPending}
                  errorKey={errorKey}
                  formId={FORM_ID}
                  onSubmit={(values) => void handleSubmit(values)}
                />
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
