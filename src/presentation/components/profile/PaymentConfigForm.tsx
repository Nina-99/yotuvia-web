import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { imageUrl } from "yotuvia-core";

import { PaymentTiersFields } from "@/presentation/components/profile/PaymentTiersFields";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  useToast,
} from "@/presentation/components/ui";
import {
  usePaymentConfig,
  useUpdatePaymentConfig,
  useUploadPaymentQr,
} from "@/presentation/hooks/use-profile";
import { toErrorKey, useErrorMessage } from "@/presentation/lib/errors";
import { toPaymentTiersPayload } from "@/presentation/schemas/profile.schemas";
import type { PaymentConfigFormValues } from "@/presentation/schemas/profile.schemas";

const QR_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

/** DOM id of this surface's form; the platform console uses its own. */
const FORM_ID = "payment-config-form";

/**
 * Payment configuration section (centre profile).
 *
 * PRODUCT CONSTRAINT: Yotuvia settles top-ups ONLY in YOTTU tokens. There is no
 * card gateway anywhere in the stack — this section manages the center's
 * transfer QR, the contact phone and the bonus-tier ladder (tokens granted per
 * amount). The copy avoids implying a payment provider.
 *
 * Contract facts (verified against `router/payment_config.router.go`,
 * `controller/payment_config.controller.go` and `data/sources/admin-api.ts`):
 * - `GET /config/payment?beauty_center_id=<id>` is public but PER-CENTRE: the
 *   form passes its own `centerId`, which the server validates before serving.
 *   `PUT /admin/config/payment` requires the `beauty_center` role and is
 *   scoped server-side to the caller's own centre (no centre id in the body).
 * - `PUT` ignores an empty phone, so the phone cannot be cleared.
 * - `tiers` is `Record<currency, { min, bonusPct }[]>` and is replaced wholesale
 *   when the record is non-empty, so the form sends the full ladder.
 * - `POST /admin/config/payment/qr` is multipart `file`; the browser upload goes
 *   through the core function with a real `File` (see `use-profile.ts`).
 *
 * The phone + tiers editor is shared with the platform console
 * (`PaymentTiersFields`); only the endpoint/centre scope differs.
 */
export function PaymentConfigForm({ centerId }: { centerId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const configQuery = usePaymentConfig(centerId);
  const updateConfig = useUpdatePaymentConfig();
  const uploadQr = useUploadPaymentQr();

  const fileRef = useRef<HTMLInputElement>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [uploadErrorKey, setUploadErrorKey] = useState<string | null>(null);

  const errorMessage = useErrorMessage(configQuery.error, "web.errors.profile_payment_fetch");

  const handleSubmit = async (values: PaymentConfigFormValues) => {
    setErrorKey(null);
    try {
      await updateConfig.mutateAsync({
        centerId,
        paymentPhone: values.paymentPhone.trim(),
        tiers: toPaymentTiersPayload(values.tiers),
      });
      toast(t("web.app.profile.payments.save_success"), { variant: "success" });
    } catch (error) {
      setErrorKey(toErrorKey(error, "web.errors.profile_payment_save"));
    }
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadErrorKey(null);
    try {
      await uploadQr.mutateAsync({ centerId, file });
      toast(t("web.app.profile.payments.upload_success"), { variant: "success" });
    } catch (error) {
      setUploadErrorKey(toErrorKey(error, "web.errors.profile_payment_upload"));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const currentQr = configQuery.data?.payment_qr_url;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("web.app.profile.payments.title")}</CardTitle>
        <p className="text-sm text-text-muted">{t("web.app.profile.payments.subtitle")}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-xs text-text-muted">{t("web.app.profile.payments.explainer")}</p>

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
          <div role="alert" className="flex flex-col gap-3">
            <p className="text-sm text-text-muted">{errorMessage}</p>
            <Button variant="outline" className="self-start" onClick={() => void configQuery.refetch()}>
              {t("common.retry")}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold text-text">
                {t("web.app.profile.payments.qr_title")}
              </h4>
              {currentQr ? (
                <img
                  src={imageUrl(currentQr)}
                  alt={t("web.app.profile.payments.qr_alt")}
                  className="h-40 w-40 rounded-lg border border-border bg-card2 object-contain p-2"
                />
              ) : (
                <p className="text-sm text-text-muted">{t("web.app.profile.payments.qr_empty")}</p>
              )}

              <label htmlFor="payment-qr-file" className="text-sm font-medium text-text">
                {t("web.app.profile.payments.qr_upload")}
              </label>
              <input
                id="payment-qr-file"
                ref={fileRef}
                type="file"
                accept={QR_ACCEPT}
                onChange={(event) => void handleUpload(event)}
                aria-describedby="payment-qr-hint"
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-input-text file:mr-3 file:rounded-md file:border-0 file:bg-card2 file:px-3 file:py-1 file:text-text focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <p id="payment-qr-hint" className="text-xs text-text-muted">
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
  );
}
