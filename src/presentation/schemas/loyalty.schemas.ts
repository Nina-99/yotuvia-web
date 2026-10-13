import { z } from "zod";
import type { AdminLoyaltyProgram } from "yotuvia-core";

import type { LoyaltyProgramInput, LoyaltyRewardType } from "@/presentation/hooks/use-loyalty";

import { validationKeys } from "./validation";

/**
 * Loyalty program form schema.
 *
 * Values stay strings (the native value of every control) and are converted to
 * the numeric contract by `toLoyaltyProgramInput`, mirroring the service form.
 *
 * Rules mirror the API DTOs (`yotuvia-api/data/request/loyalty.request.go`):
 * - `required_steps` is `required,min=1,max=50`.
 * - `reward_type` is `required,oneof=free percentage_discount`.
 * - `discount_value` is `min=0,max=100`; it only carries meaning for the
 *   percentage reward, so a `free` program sends `0`.
 *
 * `service_id` / `reward_service_id` are nullable, so the select uses an empty
 * value ("any service") that maps to `null`.
 */

export const REWARD_TYPES = ["free", "percentage_discount"] as const satisfies readonly LoyaltyRewardType[];

/** Select sentinel for the nullable `service_id` / `reward_service_id`. */
export const ANY_SERVICE_VALUE = "";

export const REQUIRED_STEPS_MIN = 1;
export const REQUIRED_STEPS_MAX = 50;
export const DISCOUNT_MAX = 100;
export const DURATION_MIN = 1;
export const DURATION_MAX = 3650;

export const loyaltyValidationKeys = {
  stepsInvalid: "web.app.loyalty.form.errors.steps",
  discountInvalid: "web.app.loyalty.form.errors.discount",
  durationInvalid: "web.app.loyalty.form.errors.duration",
} as const;

export const loyaltyProgramSchema = z
  .object({
    serviceId: z.string(),
    rewardServiceId: z.string(),
    requiredSteps: z
      .string()
      .trim()
      .min(1, validationKeys.required)
      .refine(
        (value) =>
          /^\d+$/.test(value) &&
          Number(value) >= REQUIRED_STEPS_MIN &&
          Number(value) <= REQUIRED_STEPS_MAX,
        { message: loyaltyValidationKeys.stepsInvalid },
      ),
    rewardType: z.enum(REWARD_TYPES),
    discountValue: z.string().trim(),
    // Blank = no expiry (cards never expire). Otherwise a positive day count.
    durationDays: z
      .string()
      .trim()
      .refine(
        (value) =>
          value === "" ||
          (/^\d+$/.test(value) &&
            Number(value) >= DURATION_MIN &&
            Number(value) <= DURATION_MAX),
        { message: loyaltyValidationKeys.durationInvalid },
      ),
  })
  .refine(
    (values) =>
      values.rewardType !== "percentage_discount" ||
      (/^\d+(\.\d{1,2})?$/.test(values.discountValue) &&
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
    requiredSteps: Number(values.requiredSteps),
    rewardType: values.rewardType,
    discountValue: values.rewardType === "percentage_discount" ? Number(values.discountValue) : 0,
    durationDays: values.durationDays.trim() === "" ? null : Number(values.durationDays),
  };
}
