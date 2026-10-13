import { z } from "zod";
import type { AdminPromotion } from "yotuvia-core";

import { dateKeyFromApi } from "@/presentation/lib/dates";
import type {
  PromotionInput,
  PromotionTargetClients,
  PromotionType,
} from "@/presentation/hooks/use-promotions";

import { validationKeys } from "./validation";

/**
 * Promotion form schema.
 *
 * Values stay strings (the native value of every control) and are converted to
 * the numeric/instant contract by `toPromotionInput`, mirroring the loyalty and
 * service forms.
 *
 * Rules mirror the API DTOs (`yotuvia-api/data/request/promotion.request.go`):
 * - `name` is `required,max=100`.
 * - `type` is `required,oneof=percentage fixed_amount buy_x_get_y`.
 * - `discount_value` is `min=0`; it only carries meaning for `percentage`
 *   (1–100) and `fixed_amount` (> 0), so `buy_x_get_y` sends `0`.
 * - `buy_x_count` / `buy_y_count` are `min=1` WITHOUT `omitempty`, so a `0`
 *   fails Go validation. The form forces `>= 1` for every type and the payload
 *   builder falls back to `1` for the types that ignore them.
 * - `max_redemptions` is `min=0` (0 means unlimited).
 * - `valid_from` / `valid_to` are `*time.Time`. Date-only control values are
 *   widened to RFC3339 instants: `valid_to` becomes end-of-day because the
 *   backend filter is `valid_to >= NOW()`.
 * - `applicable_hours` is a JSON array of `{ start, end }` ranges, e.g.
 *   `[{"start":"09:00","end":"18:00"}]`; empty means no hour restriction.
 *
 * `service_id` is nullable (`*uint`), so the select uses an empty value
 * ("any service") that maps to `null`.
 */

export const PROMOTION_TYPES = [
  "percentage",
  "fixed_amount",
  "buy_x_get_y",
] as const satisfies readonly PromotionType[];

export const PROMOTION_TARGET_CLIENTS = [
  "all",
  "new",
  "inactive",
] as const satisfies readonly PromotionTargetClients[];

/** Select sentinel for the nullable `service_id`. */
export const ANY_SERVICE_VALUE = "";

export const PROMOTION_NAME_MAX = 100;
export const PROMOTION_DISCOUNT_MAX = 100;

export const promotionValidationKeys = {
  name: "web.app.promotions.form.errors.name",
  discount: "web.app.promotions.form.errors.discount",
  buyCounts: "web.app.promotions.form.errors.buy_counts",
  dateOrder: "web.app.promotions.form.errors.date_order",
  dateInvalid: "web.app.promotions.form.errors.date_invalid",
  hours: "web.app.promotions.form.errors.hours",
  maxRedemptions: "web.app.promotions.form.errors.max_redemptions",
} as const;

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;
const INTEGER_PATTERN = /^\d+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Parses the `applicable_hours` JSON string; `null` means malformed. */
function parseApplicableHours(value: string): readonly { start: string; end: string }[] | null {
  const trimmed = value.trim();
  if (trimmed === "") return [];
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return null;
    const ranges: { start: string; end: string }[] = [];
    for (const item of parsed) {
      if (typeof item !== "object" || item === null) return null;
      const record = item as Record<string, unknown>;
      const start = record.start;
      const end = record.end;
      if (typeof start !== "string" || typeof end !== "string") return null;
      if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)) return null;
      ranges.push({ start, end });
    }
    return ranges;
  } catch {
    return null;
  }
}

export const promotionSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, validationKeys.required)
      .max(PROMOTION_NAME_MAX, promotionValidationKeys.name),
    description: z.string(),
    type: z.enum(PROMOTION_TYPES),
    discountValue: z.string().trim(),
    buyXCount: z.string().trim(),
    buyYCount: z.string().trim(),
    serviceId: z.string(),
    validFrom: z.string(),
    validTo: z.string(),
    applicableHours: z.string(),
    targetClients: z.enum(PROMOTION_TARGET_CLIENTS),
    maxRedemptions: z.string().trim(),
  })
  .superRefine((values, ctx) => {
    const isDiscountType = values.type === "percentage" || values.type === "fixed_amount";
    if (isDiscountType) {
      const amount = Number(values.discountValue);
      const withinRange =
        values.type === "percentage" ? amount <= PROMOTION_DISCOUNT_MAX : true;
      if (!AMOUNT_PATTERN.test(values.discountValue) || amount <= 0 || !withinRange) {
        ctx.addIssue({
          code: "custom",
          message: promotionValidationKeys.discount,
          path: ["discountValue"],
        });
      }
    }

    if (values.type === "buy_x_get_y") {
      if (!INTEGER_PATTERN.test(values.buyXCount) || Number(values.buyXCount) < 1) {
        ctx.addIssue({
          code: "custom",
          message: promotionValidationKeys.buyCounts,
          path: ["buyXCount"],
        });
      }
      if (!INTEGER_PATTERN.test(values.buyYCount) || Number(values.buyYCount) < 1) {
        ctx.addIssue({
          code: "custom",
          message: promotionValidationKeys.buyCounts,
          path: ["buyYCount"],
        });
      }
    }

    for (const key of ["validFrom", "validTo"] as const) {
      const value = values[key];
      if (value !== "" && !DATE_PATTERN.test(value)) {
        ctx.addIssue({ code: "custom", message: promotionValidationKeys.dateInvalid, path: [key] });
      }
    }

    if (
      DATE_PATTERN.test(values.validFrom) &&
      DATE_PATTERN.test(values.validTo) &&
      values.validTo < values.validFrom
    ) {
      ctx.addIssue({
        code: "custom",
        message: promotionValidationKeys.dateOrder,
        path: ["validTo"],
      });
    }

    if (values.applicableHours.trim() !== "" && parseApplicableHours(values.applicableHours) === null) {
      ctx.addIssue({
        code: "custom",
        message: promotionValidationKeys.hours,
        path: ["applicableHours"],
      });
    }

    if (values.maxRedemptions !== "" && !INTEGER_PATTERN.test(values.maxRedemptions)) {
      ctx.addIssue({
        code: "custom",
        message: promotionValidationKeys.maxRedemptions,
        path: ["maxRedemptions"],
      });
    }
  });

export type PromotionFormValues = z.infer<typeof promotionSchema>;

export const EMPTY_PROMOTION_FORM: PromotionFormValues = {
  name: "",
  description: "",
  type: "percentage",
  discountValue: "",
  buyXCount: "1",
  buyYCount: "1",
  serviceId: ANY_SERVICE_VALUE,
  validFrom: "",
  validTo: "",
  applicableHours: "",
  targetClients: "all",
  maxRedemptions: "0",
};

/** Pre-fills the edit form from an existing promotion. */
export function promotionToFormValues(promotion: AdminPromotion): PromotionFormValues {
  return {
    name: promotion.name,
    description: promotion.description ?? "",
    type: promotion.type,
    discountValue: promotion.discount_value > 0 ? String(promotion.discount_value) : "",
    buyXCount: String(promotion.buy_x_count > 0 ? promotion.buy_x_count : 1),
    buyYCount: String(promotion.buy_y_count > 0 ? promotion.buy_y_count : 1),
    serviceId:
      promotion.service_id === undefined || promotion.service_id === null
        ? ANY_SERVICE_VALUE
        : String(promotion.service_id),
    validFrom: promotion.valid_from ? dateKeyFromApi(promotion.valid_from) : "",
    validTo: promotion.valid_to ? dateKeyFromApi(promotion.valid_to) : "",
    applicableHours: promotion.applicable_hours ?? "",
    targetClients: promotion.target_clients,
    maxRedemptions: String(promotion.max_redemptions ?? 0),
  };
}

/**
 * Widens a date-only control value to an RFC3339 instant.
 *
 * `valid_to` uses end-of-day so a promotion drawn "to 2026-12-31" stays active
 * through that whole day — the backend filter is `valid_to >= NOW()`.
 */
function toInstant(dateKey: string, edge: "start" | "end"): string | null {
  if (dateKey === "") return null;
  return edge === "start" ? `${dateKey}T00:00:00Z` : `${dateKey}T23:59:59Z`;
}

/** Maps validated form values onto the shared create/update input contract. */
export function toPromotionInput(values: PromotionFormValues): PromotionInput {
  const isDiscountType = values.type === "percentage" || values.type === "fixed_amount";
  const isBuyXGetY = values.type === "buy_x_get_y";

  return {
    name: values.name.trim(),
    description: values.description.trim(),
    type: values.type,
    discountValue: isDiscountType ? Number(values.discountValue) : 0,
    buyXCount: isBuyXGetY ? Number(values.buyXCount) : 1,
    buyYCount: isBuyXGetY ? Number(values.buyYCount) : 1,
    serviceId: values.serviceId === ANY_SERVICE_VALUE ? null : Number(values.serviceId),
    validFrom: toInstant(values.validFrom, "start"),
    validTo: toInstant(values.validTo, "end"),
    applicableHours: values.applicableHours.trim(),
    targetClients: values.targetClients,
    maxRedemptions: values.maxRedemptions === "" ? 0 : Number(values.maxRedemptions),
  };
}
