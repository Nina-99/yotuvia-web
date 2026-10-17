import { z } from "zod";
import { LIMITS, type AdminLoyaltyProgram } from "yotuvia-core";

import type { LoyaltyProgramInput, LoyaltyRewardType } from "@/presentation/hooks/use-loyalty";

import { integerFromField, zInteger } from "./validation";

/**
 * Loyalty program form schema.
 *
 * Values stay strings (the native value of every control) and are converted to
 * the numeric contract by `toLoyaltyProgramInput`, mirroring the service form.
 *
 * The BOUNDS come from the shared `LIMITS` (which mirrors
 * `yotuvia-api/data/request/loyalty.request.go`) and the RULES from the shared
 * validation layer, so mobile validates these fields identically.
 * - `required_steps` is `required,min=1,max=50`.
 * - `reward_type` is `required,oneof=free percentage_discount`.
 * - `discount_value` is `min=0,max=100` in the API; the form additionally
 *   requires it to be GREATER THAN ZERO for a percentage reward, because a 0%
 *   reward is not a reward. Kept deliberately stricter than the API.
 *
 * `service_id` / `reward_service_id` are nullable, so the select uses an empty
 * value ("any service") that maps to `null`.
 */

export const REWARD_TYPES = ["free", "percentage_discount"] as const satisfies readonly LoyaltyRewardType[];

/** Select sentinel for the nullable `service_id` / `reward_service_id`. */
export const ANY_SERVICE_VALUE = "";

export const REQUIRED_STEPS_MIN = LIMITS.loyaltyRequiredSteps.min;
export const REQUIRED_STEPS_MAX = LIMITS.loyaltyRequiredSteps.max;
export const DISCOUNT_MAX = LIMITS.loyaltyDiscountPercent.max;
export const DURATION_MIN = LIMITS.loyaltyDurationDays.min;
export const DURATION_MAX = LIMITS.loyaltyDurationDays.max;

export const loyaltyValidationKeys = {
  stepsInvalid: "web.app.loyalty.form.errors.steps",
  discountInvalid: "web.app.loyalty.form.errors.discount",
  durationInvalid: "web.app.loyalty.form.errors.duration",
} as const;

/**
 * A percentage: canonical, at most two decimals.
 *
 * Deliberately NOT the money rule. A discount is capped at 100, so locale
 * grouping can only ever produce a value the API rejects; reading `1.234` as
 * 1234 here would turn a typo into a 422 instead of an inline error.
 */
const PERCENT_PATTERN = /^\d+(\.\d{1,2})?$/;

export const loyaltyProgramSchema = z
  .object({
    serviceId: z.string(),
    rewardServiceId: z.string(),
    requiredSteps: zInteger(LIMITS.loyaltyRequiredSteps, {
      overrides: {
        not_a_number: loyaltyValidationKeys.stepsInvalid,
        out_of_range: loyaltyValidationKeys.stepsInvalid,
      },
    }),
    rewardType: z.enum(REWARD_TYPES),
    discountValue: z.string().trim(),
    // Blank = no expiry (cards never expire). Otherwise a positive day count.
    durationDays: zInteger(LIMITS.loyaltyDurationDays, {
      optional: true,
      overrides: {
        not_a_number: loyaltyValidationKeys.durationInvalid,
        out_of_range: loyaltyValidationKeys.durationInvalid,
      },
    }),
  })
  .refine(
    (values) =>
      values.rewardType !== "percentage_discount" ||
      (PERCENT_PATTERN.test(values.discountValue) &&
        Number(values.discountValue) > 0 &&
        Number(values.discountValue) <= DISCOUNT_MAX),
    { message: loyaltyValidationKeys.discountInvalid, path: ["discountValue"] },
  );

export type LoyaltyProgramFormValues = z.infer<typeof loyaltyProgramSchema>;

export const EMPTY_LOYALTY_PROGRAM_FORM: LoyaltyProgramFormValues = {
  serviceId: ANY_SERVICE_VALUE,
  rewardServiceId: ANY_SERVICE_VALUE,
  requiredSteps: "10",
  rewardType: "free",
  discountValue: "0",
  durationDays: "",
};

/** Pre-fills the edit form from an existing program. */
export function loyaltyProgramToFormValues(
  program: AdminLoyaltyProgram,
): LoyaltyProgramFormValues {
  return {
    serviceId: program.service_id === null ? ANY_SERVICE_VALUE : String(program.service_id),
    rewardServiceId:
      program.reward_service_id === null ? ANY_SERVICE_VALUE : String(program.reward_service_id),
    requiredSteps: String(program.required_steps),
    rewardType: program.reward_type === "percentage_discount" ? "percentage_discount" : "free",
    discountValue: String(program.discount_value),
    durationDays:
      program.duration_days === null || program.duration_days === undefined
        ? ""
        : String(program.duration_days),
  };
}

/** Maps validated form values onto the shared create/update input contract. */
export function toLoyaltyProgramInput(values: LoyaltyProgramFormValues): LoyaltyProgramInput {
  return {
    serviceId: values.serviceId === ANY_SERVICE_VALUE ? null : Number(values.serviceId),
    rewardServiceId:
      values.rewardServiceId === ANY_SERVICE_VALUE ? null : Number(values.rewardServiceId),
    requiredSteps: integerFromField(values.requiredSteps, LIMITS.loyaltyRequiredSteps),
    rewardType: values.rewardType,
    discountValue: values.rewardType === "percentage_discount" ? Number(values.discountValue) : 0,
    durationDays:
      values.durationDays.trim() === ""
        ? null
        : integerFromField(values.durationDays, LIMITS.loyaltyDurationDays),
  };
}
