import { z } from "zod";
import {
  DEFAULT_LANGUAGE,
  baseTranslation,
  compactTranslation,
  fullTranslation,
  hasAnyTranslation,
} from "yotuvia-core";
import type { BeautyCenter, PaymentConfig, SocialMedia, WorkingHour } from "yotuvia-core";

import { validationKeys } from "./validation";

/**
 * Profile-section schemas: center details (with working hours), gallery images,
 * social links and payment configuration.
 *
 * Bounds mirror the API DTOs and the `yotuvia-core` mappers:
 * - `UpdateBeautyCenterRequest` (`yotuvia-api/data/request/beauty_center.request.go`):
 *   `address` `omitempty,min=5`, `email` `omitempty,email,max=70`, `phone`
 *   `omitempty,max=20`, `description` `omitempty,max=255`, `currency`
 *   `omitempty,len=3`, `password` `omitempty,min=8`.
 * - `WorkingHourRequest`: `day_of_week` `required,min=0,max=6`,
 *   `start_time`/`end_time` `required,len=5` (`HH:MM`).
 * - `BeautyCenterImageRequest`: `image_url` required.
 * - `CreateSocialMediaRequest` / `UpdateSocialMediaRequest`: every link is
 *   `omitempty,url`.
 *
 * SEMANTICS THAT SHAPE THE FORMS: the Go service applies a field only when its
 * string is non-empty, so a value cannot be CLEARED through this payload. The
 * schemas therefore treat the editable strings as required (saving an empty
 * value would silently do nothing) and mark the optional ones as
 * "delete not supported" instead of pretending.
 */

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const URL_PATTERN = /^https?:\/\/\S+$/i;
/**
 * Accepts an absolute `http(s)` URL or a root-relative path — the two shapes
 * the API returns for uploaded images (`/uploads/...`) and the shape the
 * service `imageUrlField` already accepts. Anything else (spaces,
 * `javascript:`, a bare fragment) is rejected before it reaches the server.
 */
const IMAGE_URL_PATTERN = /^(https?:\/\/|\/)[^\s]*$/i;
const INTEGER_PATTERN = /^\d+$/;
const DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export const CENTER_NAME_MAX = 120;
export const CENTER_DESCRIPTION_MAX = 255;
export const CENTER_EMAIL_MAX = 70;
export const CENTER_PHONE_MAX = 20;

export const profileValidationKeys = {
  required: validationKeys.required,
  emailInvalid: validationKeys.emailInvalid,
  passwordMin: validationKeys.passwordMin,
  addressMin: "web.app.profile.details.errors.address",
  max: "web.app.profile.details.errors.max",
  currency: "web.app.profile.details.errors.currency",
  number: "web.app.profile.details.errors.number",
  latitude: "web.app.profile.details.errors.latitude",
  longitude: "web.app.profile.details.errors.longitude",
  percent: "web.app.profile.details.errors.percent",
  url: "web.app.profile.details.errors.url",
  hoursTime: "web.app.profile.hours.errors.time",
  hoursOrder: "web.app.profile.hours.errors.order",
  imageUrl: "web.app.profile.gallery.errors.url",
  socialUrl: "web.app.profile.social.errors.url",
  paymentPhone: "web.app.profile.payments.errors.phone",
  paymentCurrency: "web.app.profile.payments.errors.currency",
  paymentTierMin: "web.app.profile.payments.errors.tier_min",
  paymentTierBonus: "web.app.profile.payments.errors.tier_bonus",
} as const;

/** Currencies offered by the profile select (3-letter ISO codes, as the API requires). */
export const CENTER_CURRENCIES = [
  "USD",
  "EUR",
  "ARS",
  "BRL",
  "UYU",
  "BOB",
  "CLP",
  "COP",
  "PYG",
  "PEN",
  "VES",
] as const;

/** Day labels are indexed 0=Sunday..6=Saturday, matching `day_of_week`. */
export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/* ── Working hours ──────────────────────────────────────────────── */

export const workingHourSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(TIME_PATTERN, profileValidationKeys.hoursTime),
    endTime: z.string().regex(TIME_PATTERN, profileValidationKeys.hoursTime),
  })
  .superRefine((value, ctx) => {
    if (
      TIME_PATTERN.test(value.startTime) &&
      TIME_PATTERN.test(value.endTime) &&
      value.endTime <= value.startTime
    ) {
      ctx.addIssue({
        code: "custom",
        message: profileValidationKeys.hoursOrder,
        path: ["endTime"],
      });
    }
  });

export type WorkingHourFormValues = z.infer<typeof workingHourSchema>;

/* ── Center details ─────────────────────────────────────────────── */

const optionalUrl = z
  .string()
  .trim()
  .refine((value) => value === "" || URL_PATTERN.test(value), profileValidationKeys.url);

/** Same rule as `optionalUrl`, but for image fields: also accepts `/relative` upload paths. */
const optionalImageUrl = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || IMAGE_URL_PATTERN.test(value),
    profileValidationKeys.url,
  );
/** Same rule as `optionalUrl`, with social-link specific error copy. */
const optionalSocialUrl = z
  .string()
  .trim()
  .refine((value) => value === "" || URL_PATTERN.test(value), profileValidationKeys.socialUrl);

const optionalAmount = z
  .string()
  .trim()
  .refine((value) => value === "" || DECIMAL_PATTERN.test(value), profileValidationKeys.number);

const optionalLatitude = z
  .string()
  .trim()
  .refine((value) => {
    if (value === "") return true;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= -90 && parsed <= 90;
  }, profileValidationKeys.latitude);

const optionalLongitude = z
  .string()
  .trim()
  .refine((value) => {
    if (value === "") return true;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= -180 && parsed <= 180;
  }, profileValidationKeys.longitude);

const optionalInteger = z
  .string()
  .trim()
  .refine((value) => value === "" || INTEGER_PATTERN.test(value), profileValidationKeys.number);

export const centerProfileSchema = z
  .object({
    nameI18n: z.record(
      z.string(),
      z.string().trim().max(CENTER_NAME_MAX, profileValidationKeys.max),
    ),
    address: z
      .string()
      .trim()
      .min(5, profileValidationKeys.addressMin)
      .max(200, profileValidationKeys.max),
    email: z
      .string()
      .trim()
      .min(1, validationKeys.required)
      .max(CENTER_EMAIL_MAX, profileValidationKeys.max)
      .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, validationKeys.emailInvalid),
    phone: z
      .string()
      .trim()
      .min(1, validationKeys.required)
      .max(CENTER_PHONE_MAX, profileValidationKeys.max),
    url: optionalUrl,
    descriptionI18n: z.record(
      z.string(),
      z.string().trim().max(CENTER_DESCRIPTION_MAX, profileValidationKeys.max),
    ),
    currency: z.string().regex(CURRENCY_PATTERN, profileValidationKeys.currency),
    latitude: optionalLatitude,
    longitude: optionalLongitude,
    password: z
      .string()
      .refine((value) => value === "" || value.length >= 8, validationKeys.passwordMin),
    depositRequired: z.boolean(),
    depositAmount: optionalAmount,
    depositPercent: z
      .string()
      .trim()
      .refine(
        (value) => value === "" || (DECIMAL_PATTERN.test(value) && Number(value) <= 100),
        profileValidationKeys.percent,
      ),
    depositTrustThreshold: optionalInteger,
    depositHoldMinutes: optionalInteger,
    depositQrUrl: optionalImageUrl,
    schedules: z.array(workingHourSchema),
  })
  .superRefine((values, ctx) => {
    // The owner must provide the center name in at least one language.
    if (!hasAnyTranslation(values.nameI18n)) {
      ctx.addIssue({
        code: "custom",
        message: validationKeys.required,
        path: ["nameI18n", DEFAULT_LANGUAGE],
      });
    }
    const seen = new Set<number>();
    values.schedules.forEach((schedule, index) => {
      if (seen.has(schedule.dayOfWeek)) {
        ctx.addIssue({
          code: "custom",
          message: profileValidationKeys.hoursOrder,
          path: ["schedules", index, "dayOfWeek"],
        });
      }
      seen.add(schedule.dayOfWeek);
    });
  });

export type CenterProfileFormValues = z.infer<typeof centerProfileSchema>;

/** Pre-fills the profile form from the domain center entity. */
export function centerToFormValues(center: BeautyCenter): CenterProfileFormValues {
  return {
    nameI18n: fullTranslation(center.nameI18n, center.name ?? ""),
    address: center.address ?? "",
    email: center.email ?? "",
    phone: center.phone ?? "",
    url: center.url ?? "",
    descriptionI18n: fullTranslation(center.descriptionI18n, center.description ?? ""),
    currency: center.currency?.trim() ? center.currency : "USD",
    latitude: center.latitude !== undefined && center.latitude !== null ? String(center.latitude) : "",
    longitude:
      center.longitude !== undefined && center.longitude !== null ? String(center.longitude) : "",
    password: "",
    depositRequired: center.depositRequired ?? false,
    depositAmount:
      center.depositAmount !== undefined && center.depositAmount !== null
        ? String(center.depositAmount)
        : "",
    depositPercent:
      center.depositPercent !== undefined && center.depositPercent !== null
        ? String(center.depositPercent)
        : "",
    depositTrustThreshold:
      center.depositTrustThreshold !== undefined && center.depositTrustThreshold !== null
        ? String(center.depositTrustThreshold)
        : "",
    depositHoldMinutes:
      center.depositHoldMinutes !== undefined && center.depositHoldMinutes !== null
        ? String(center.depositHoldMinutes)
        : "",
    depositQrUrl: center.depositQrUrl ?? "",
    schedules: (center.schedules ?? [])
      .map((schedule) => ({
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      }))
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek),
  };
}

/** Parses an optional numeric field into a number, or `undefined` when blank. */
function optionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : Number(trimmed);
}

/**
 * Maps validated form values onto the admin-center update payload.
 *
 * A blank optional field is OMITTED (not sent as empty) so the Go service keeps
 * the previous value — the honest behaviour given the API cannot clear fields.
 */
export function toCenterUpdatePayload(
  values: CenterProfileFormValues,
): Partial<BeautyCenter> & { password?: string } {
  const payload: Partial<BeautyCenter> & { password?: string } = {
    name: baseTranslation(values.nameI18n),
    nameI18n: compactTranslation(values.nameI18n),
    address: values.address.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
    url: values.url.trim(),
    description: baseTranslation(values.descriptionI18n),
    descriptionI18n: compactTranslation(values.descriptionI18n),
    currency: values.currency,
    depositRequired: values.depositRequired,
    schedules: values.schedules.map<WorkingHour>((schedule) => ({
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
    })),
  };

  const latitude = optionalNumber(values.latitude);
  if (latitude !== undefined) payload.latitude = latitude;
  const longitude = optionalNumber(values.longitude);
  if (longitude !== undefined) payload.longitude = longitude;

  if (values.password !== "") payload.password = values.password;

  const depositAmount = optionalNumber(values.depositAmount);
  if (depositAmount !== undefined) payload.depositAmount = depositAmount;
  const depositPercent = optionalNumber(values.depositPercent);
  if (depositPercent !== undefined) payload.depositPercent = depositPercent;
  const depositTrustThreshold = optionalNumber(values.depositTrustThreshold);
  if (depositTrustThreshold !== undefined) payload.depositTrustThreshold = depositTrustThreshold;
  const depositHoldMinutes = optionalNumber(values.depositHoldMinutes);
  if (depositHoldMinutes !== undefined) payload.depositHoldMinutes = depositHoldMinutes;
  if (values.depositQrUrl.trim() !== "") payload.depositQrUrl = values.depositQrUrl.trim();

  return payload;
}

/* ── Gallery ────────────────────────────────────────────────────── */

export const galleryImageSchema = z.object({
  imageUrl: z
    .string()
    .trim()
    .min(1, validationKeys.required)
    .refine((value) => IMAGE_URL_PATTERN.test(value), profileValidationKeys.imageUrl),
  isCover: z.boolean(),
  isProfile: z.boolean(),
});

export type GalleryImageFormValues = z.infer<typeof galleryImageSchema>;

export const EMPTY_GALLERY_IMAGE: GalleryImageFormValues = {
  imageUrl: "",
  isCover: false,
  isProfile: false,
};

/* ── Social links ───────────────────────────────────────────────── */

export const socialMediaSchema = z.object({
  google: optionalSocialUrl,
  facebook: optionalSocialUrl,
  instagram: optionalSocialUrl,
  twitter: optionalSocialUrl,
  tiktok: optionalSocialUrl,
});

export type SocialMediaFormValues = z.infer<typeof socialMediaSchema>;

export const SOCIAL_LINK_FIELDS = ["google", "facebook", "instagram", "twitter", "tiktok"] as const;

export function socialToFormValues(social: SocialMedia | null): SocialMediaFormValues {
  return {
    google: social?.google ?? "",
    facebook: social?.facebook ?? "",
    instagram: social?.instagram ?? "",
    twitter: social?.twitter ?? "",
    tiktok: social?.tiktok ?? "",
  };
}

/** Maps the form onto the upsert input, dropping blank links. */
export function toSocialUpsertPayload(
  centerId: number,
  values: SocialMediaFormValues,
): { beautyCenterId: number } & Partial<SocialMedia> {
  const payload: { beautyCenterId: number } & Partial<SocialMedia> = { beautyCenterId: centerId };
  for (const field of SOCIAL_LINK_FIELDS) {
    const value = values[field].trim();
    if (value !== "") payload[field] = value;
  }
  return payload;
}

/* ── Payment config ─────────────────────────────────────────────── */

export const paymentTierSchema = z.object({
  currency: z.string().trim().toUpperCase().regex(CURRENCY_PATTERN, profileValidationKeys.paymentCurrency),
  min: z.string().trim().regex(DECIMAL_PATTERN, profileValidationKeys.paymentTierMin),
  bonusPct: z
    .string()
    .trim()
    .regex(DECIMAL_PATTERN, profileValidationKeys.paymentTierBonus)
    .refine((value) => Number(value) <= 100, profileValidationKeys.paymentTierBonus),
});

export type PaymentTierFormValues = z.infer<typeof paymentTierSchema>;

export const paymentConfigSchema = z.object({
  paymentPhone: z.string().trim().min(1, profileValidationKeys.paymentPhone).max(20, profileValidationKeys.max),
  tiers: z.array(paymentTierSchema),
});

export type PaymentConfigFormValues = z.infer<typeof paymentConfigSchema>;

/**
 * Flattens the API's `Record<currency, tiers[]>` into editable rows.
 *
 * Rows are sorted by currency then minimum so a reload keeps the ladder stable.
 */
export function paymentConfigToFormValues(config: PaymentConfig): PaymentConfigFormValues {
  const rows: PaymentTierFormValues[] = [];
  for (const [currency, tiers] of Object.entries(config.tiers ?? {})) {
    for (const tier of tiers) {
      rows.push({
        currency,
        min: String(tier.min),
        bonusPct: String(tier.bonusPct),
      });
    }
  }
  rows.sort((a, b) => a.currency.localeCompare(b.currency) || Number(a.min) - Number(b.min));
  return { paymentPhone: config.payment_phone ?? "", tiers: rows };
}

/** Groups the flat editable rows back into the API's per-currency record. */
export function toPaymentTiersPayload(
  rows: PaymentTierFormValues[],
): PaymentConfig["tiers"] {
  const tiers: PaymentConfig["tiers"] = {};
  for (const row of rows) {
    const currency = row.currency.trim().toUpperCase();
    const bucket = tiers[currency] ?? [];
    bucket.push({ min: Number(row.min), bonusPct: Number(row.bonusPct) });
    tiers[currency] = bucket;
  }
  return tiers;
}
