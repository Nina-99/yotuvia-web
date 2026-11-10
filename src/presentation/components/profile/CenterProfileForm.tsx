import { Suspense, lazy, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFieldArray } from "react-hook-form";
import type { BeautyCenter } from "yotuvia-core";

import { Form, FormAlert, FormField, ImageUploadField, NumberInput, PhoneInput, useZodForm } from "@/presentation/components/form";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select, Textarea } from "@/presentation/components/ui";
import type { CenterCoords } from "@/presentation/components/centers/CenterLocationPicker";
import { LANGUAGES } from "yotuvia-core";
import { useUploadDepositQr } from "@/presentation/hooks/use-profile";
import {
  CENTER_CURRENCIES,
  CENTER_DESCRIPTION_MAX,
  CENTER_EMAIL_MAX,
  CENTER_NAME_MAX,
  WEEKDAYS,
  centerProfileSchema,
  centerToFormValues,
} from "@/presentation/schemas/profile.schemas";
import type { CenterProfileFormValues } from "@/presentation/schemas/profile.schemas";

export interface CenterProfileFormProps {
  center: BeautyCenter;
  saving: boolean;
  /** i18n key of the last failed save, or `null`. */
  errorKey: string | null;
  onSubmit: (values: CenterProfileFormValues) => void;
}

/**
 * The picker dialog owns the heavy map chunk: it is only fetched once the
 * owner actually asks to edit the location, so `maplibre-gl` never enters the
 * entry or profile chunks.
 */
const CenterLocationPicker = lazy(
  () => import("@/presentation/components/centers/CenterLocationPicker"),
);

/** Parses a stored coordinate string, or `null` when blank/unparseable. */
function parseCoordinate(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Center profile form: business data, location, optional password change,
 * deposit policy and working hours.
 *
 * Contract facts surfaced in the copy rather than silently swallowed:
 * - The update endpoint IGNORES empty strings, so a saved value cannot be
 *   cleared from here. Optional fields therefore omit themselves when blank
 *   (see `toCenterUpdatePayload`) and the password field explains that leaving
 *   it empty keeps the current one.
 * - `schedules` is a REPLACEMENT array: saving sends the full visible list, so
 *   removing a row here removes the range server-side. An empty list is a no-op
 *   on the backend, so the helper text says at least one row is needed to change
 *   the schedule.
 */
export function CenterProfileForm({ center, saving, errorKey, onSubmit }: CenterProfileFormProps) {
  const { t } = useTranslation();
  const form = useZodForm<CenterProfileFormValues>({
    schema: centerProfileSchema,
    defaultValues: centerToFormValues(center),
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "schedules" });
  const [pickerOpen, setPickerOpen] = useState(false);

  const latitudeValue = form.watch("latitude");
  const longitudeValue = form.watch("longitude");

  const depositQrUpload = useUploadDepositQr();
  const depositQrValue = form.watch("depositQrUrl");
  const depositQrUploadError =
    depositQrUpload.validationErrorKey ?? depositQrUpload.errorKey;  const parsedLatitude = parseCoordinate(latitudeValue);
  const parsedLongitude = parseCoordinate(longitudeValue);
  const hasLocation = parsedLatitude !== null && parsedLongitude !== null;
  const pickerInitial: CenterCoords | null =
    hasLocation && parsedLatitude !== null && parsedLongitude !== null
      ? { latitude: parsedLatitude, longitude: parsedLongitude }
      : null;

  const handleOpenPicker = useCallback(() => setPickerOpen(true), []);
  const handleClosePicker = useCallback(() => setPickerOpen(false), []);
  // Confirm boundary: the dialog draft writes to the form ONLY here, so
  // Cancel/Escape leaves every value untouched.
  const handleConfirmLocation = useCallback(
    (coords: CenterCoords) => {
      form.setValue("latitude", String(coords.latitude), {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue("longitude", String(coords.longitude), {
        shouldDirty: true,
        shouldValidate: true,
      });
      setPickerOpen(false);
    },
    [form],
  );

  return (
    <Form form={form} id="center-profile-form" className="flex flex-col gap-6" onSubmit={onSubmit}>
      <FormAlert message={errorKey} variant="error" />

      <Card>
        <CardHeader>
          <CardTitle>{t("web.app.profile.details.business_title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {LANGUAGES.map(({ code, label }) => (
              <FormField
                key={`name-${code}`}
                name={`nameI18n.${code}`}
                label={`${t("web.app.profile.details.name")} (${label})`}
              >
                {({ field, invalid, describedBy, id }) => (
                  <Input
                    {...field}
                    id={id}
                    maxLength={CENTER_NAME_MAX}
                    aria-invalid={invalid || undefined}
                    aria-describedby={describedBy}
                  />
                )}
              </FormField>
            ))}
          </div>

          <FormField name="currency" label={t("web.app.profile.details.currency")}>
            {({ field, invalid, describedBy, id }) => (
              <Select {...field} id={id} aria-invalid={invalid || undefined} aria-describedby={describedBy}>
                {CENTER_CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          <FormField name="address" label={t("web.app.profile.details.address")}>
            {({ field, invalid, describedBy, id }) => (
              <Input {...field} id={id} aria-invalid={invalid || undefined} aria-describedby={describedBy} />
            )}
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField name="email" label={t("web.app.profile.details.email")}>
              {({ field, invalid, describedBy, id }) => (
                <Input
                  {...field}
                  id={id}
                  type="email"
                  maxLength={CENTER_EMAIL_MAX}
                  autoComplete="email"
                  aria-invalid={invalid || undefined}
                  aria-describedby={describedBy}
                />
              )}
            </FormField>

            <FormField name="phone" label={t("web.app.profile.details.phone")}>
              {({ field, invalid, describedBy, id }) => (
                <PhoneInput {...field} id={id} invalid={invalid} describedBy={describedBy} />
              )}
            </FormField>
          </div>

          <FormField name="url" label={t("web.app.profile.details.url")}>
            {({ field, invalid, describedBy, id }) => (
              <Input
                {...field}
                id={id}
                type="url"
                placeholder="https://"
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              />
            )}
          </FormField>

          {LANGUAGES.map(({ code, label }) => (
            <FormField
              key={`description-${code}`}
              name={`descriptionI18n.${code}`}
              label={`${t("web.app.profile.details.description")} (${label})`}
            >
              {({ field, invalid, describedBy, id }) => (
                <Textarea
                  {...field}
                  id={id}
                  rows={3}
                  maxLength={CENTER_DESCRIPTION_MAX}
                  aria-invalid={invalid || undefined}
                  aria-describedby={describedBy}
                />
              )}
            </FormField>
          ))}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField name="latitude" label={t("web.app.profile.details.latitude")}>
              {({ invalid, describedBy, id }) => (
                <p
                  id={id}
                  aria-invalid={invalid || undefined}
                  aria-describedby={describedBy}
                  className="text-sm text-text"
                >
                  {latitudeValue.trim() !== "" ? latitudeValue : "—"}
                </p>
              )}
            </FormField>

            <FormField name="longitude" label={t("web.app.profile.details.longitude")}>
              {({ invalid, describedBy, id }) => (
                <p
                  id={id}
                  aria-invalid={invalid || undefined}
                  aria-describedby={describedBy}
                  className="text-sm text-text"
                >
                  {longitudeValue.trim() !== "" ? longitudeValue : "—"}
                </p>
              )}
            </FormField>
          </div>

          {hasLocation ? null : (
            <p className="text-xs text-text-muted">
              {t("web.app.profile.details.location.no_coordinates")}
            </p>
          )}

          <Button type="button" variant="outline" className="self-start" onClick={handleOpenPicker}>
            {t("admin.profile.pick_on_map")}
          </Button>

          <Suspense fallback={null}>
            <CenterLocationPicker
              open={pickerOpen}
              initial={pickerInitial}
              onConfirm={handleConfirmLocation}
              onClose={handleClosePicker}
            />
          </Suspense>

          <FormField
            name="password"
            label={t("web.app.profile.details.password")}
            helperText={t("web.app.profile.details.password_hint")}
          >
            {({ field, invalid, describedBy, id }) => (
              <Input
                {...field}
                id={id}
                type="password"
                autoComplete="new-password"
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              />
            )}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("web.app.profile.hours.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-xs text-text-muted">{t("web.app.profile.hours.help")}</p>

          {fields.length === 0 ? (
            <p className="text-sm text-text-muted">{t("web.app.profile.hours.empty")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {fields.map((item, index) => (
                <li key={item.id} className="flex flex-wrap items-end gap-3">
                  <FormField
                    name={`schedules.${index}.dayOfWeek`}
                    label={t("web.app.profile.hours.day")}
                    className="min-w-[9rem] flex-1"
                  >
                    {({ field, invalid, describedBy, id }) => (
                      <Select
                        id={id}
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        value={String(field.value)}
                        onChange={(event) => field.onChange(Number(event.target.value))}
                        aria-invalid={invalid || undefined}
                        aria-describedby={describedBy}
                      >
                        {WEEKDAYS.map((day) => (
                          <option key={day} value={day}>
                            {t(`web.app.profile.hours.day_${day}`)}
                          </option>
                        ))}
                      </Select>
                    )}
                  </FormField>

                  <FormField
                    name={`schedules.${index}.startTime`}
                    label={t("web.app.profile.hours.start")}
                    className="min-w-[7rem] flex-1"
                  >
                    {({ field, invalid, describedBy, id }) => (
                      <Input
                        {...field}
                        id={id}
                        type="time"
                        aria-invalid={invalid || undefined}
                        aria-describedby={describedBy}
                      />
                    )}
                  </FormField>

                  <FormField
                    name={`schedules.${index}.endTime`}
                    label={t("web.app.profile.hours.end")}
                    className="min-w-[7rem] flex-1"
                  >
                    {({ field, invalid, describedBy, id }) => (
                      <Input
                        {...field}
                        id={id}
                        type="time"
                        aria-invalid={invalid || undefined}
                        aria-describedby={describedBy}
                      />
                    )}
                  </FormField>

                  <Button
                    variant="outline"
                    onClick={() => remove(index)}
                    aria-label={t("web.app.profile.hours.remove_aria", {
                      day: t(`web.app.profile.hours.day_${item.dayOfWeek}`),
                    })}
                  >
                    {t("web.app.profile.hours.remove")}
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <Button
            variant="secondary"
            className="self-start"
            onClick={() => append({ dayOfWeek: 1, startTime: "09:00", endTime: "18:00" })}
          >
            {t("web.app.profile.hours.add")}
          </Button>
        </CardContent>
      </Card>

      <details className="rounded-lg border border-border bg-card">
        <summary className="cursor-pointer p-4 text-sm font-semibold text-text">
          {t("web.app.profile.details.deposit_title")}
        </summary>
        <div className="flex flex-col gap-4 px-4 pb-4">
          <p className="text-xs text-text-muted">{t("web.app.profile.details.deposit_help")}</p>

          <FormField name="depositRequired" label={t("web.app.profile.details.deposit_required")}>
            {({ field, describedBy, id }) => (
              <label htmlFor={id} className="flex items-center gap-2 text-sm text-text">
                <input
                  id={id}
                  type="checkbox"
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  checked={Boolean(field.value)}
                  onChange={(event) => field.onChange(event.target.checked)}
                  aria-describedby={describedBy}
                  className="h-4 w-4 rounded border-border accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
                {t("web.app.profile.details.deposit_required_hint")}
              </label>
            )}
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField name="depositAmount" label={t("web.app.profile.details.deposit_amount")}>
              {({ field, invalid, describedBy, id }) => (
                <NumberInput
                  {...field}
                  id={id}
                  variant="money"
                  invalid={invalid}
                  describedBy={describedBy}
                />
              )}
            </FormField>

            <FormField name="depositPercent" label={t("web.app.profile.details.deposit_percent")}>
              {({ field, invalid, describedBy, id }) => (
                <NumberInput
                  {...field}
                  id={id}
                  variant="decimal"
                  invalid={invalid}
                  describedBy={describedBy}
                />
              )}
            </FormField>

            <FormField
              name="depositTrustThreshold"
              label={t("web.app.profile.details.deposit_trust_threshold")}
            >
              {({ field, invalid, describedBy, id }) => (
                <NumberInput
                  {...field}
                  id={id}
                  variant="integer"
                  invalid={invalid}
                  describedBy={describedBy}
                />
              )}
            </FormField>

            <FormField name="depositHoldMinutes" label={t("web.app.profile.details.deposit_hold_minutes")}>
              {({ field, invalid, describedBy, id }) => (
                <NumberInput
                  {...field}
                  id={id}
                  variant="integer"
                  invalid={invalid}
                  describedBy={describedBy}
                />
              )}
            </FormField>
          </div>

          <FormField name="depositQrUrl" label={t("web.app.profile.details.deposit_qr_url")}>
            {({ field, invalid, describedBy, id }) => (
              <Input
                {...field}
                id={id}
                type="url"
                placeholder="https://"
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              />
            )}
          </FormField>

          {/*
           * Booking-deposit collection QR upload (upload-then-set): a successful
           * upload fills `depositQrUrl` and the normal save persists it. This
           * is NOT the Ytv top-up QR (`web.app.profile.payments.qr_*`,
           * `useUploadPaymentQr`) — distinct hook, distinct copy.
           */}
          <ImageUploadField
            currentSrc={depositQrValue}
            previewAlt={t("web.profile_image.preview")}
            pickLabel={
              depositQrValue.trim() === ""
                ? t("web.app.profile.details.deposit_qr_upload")
                : t("web.app.profile.details.deposit_qr_pick")
            }
            hint={t("web.app.profile.details.deposit_qr_hint")}
            uploadingLabel={t("web.profile_image.uploading")}
            uploading={depositQrUpload.status === "uploading"}
            errorMessage={depositQrUploadError ? t(depositQrUploadError) : null}
            onUpload={(file) => depositQrUpload.upload(file)}
            onUploaded={(url) =>
              form.setValue("depositQrUrl", url, { shouldDirty: true, shouldValidate: true })
            }
          />
        </div>
      </details>

      <div className="flex justify-end">
        <Button type="submit" loading={saving}>
          {t("web.app.profile.details.save")}
        </Button>
      </div>
    </Form>
  );
}
