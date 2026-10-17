import { z } from "zod";
import {
  LIMITS,
  email as coreEmail,
  password as corePassword,
  phone as corePhone,
  text as coreText,
  type LengthBounds,
  type ValidationCode,
  type ValidationResult,
} from "yotuvia-core";

/**
 * The web's bridge to the SHARED rules in `yotuvia-core`.
 *
 * The rules themselves live in the core so both clients validate identically;
 * what stays here is the web's own vocabulary — the i18n KEYS its forms render.
 * A rule returns a CODE (the core has no locale), and this module turns that code
 * into a key.
 *
 * Bounds are re-exported from the core's `LIMITS`, which mirrors the Go request
 * DTOs, so a schema can never drift from what the API accepts.
 */

/** Password bounds, from the shared contract (never re-typed here). */
export const PASSWORD_MIN_LENGTH = LIMITS.password.min;
export const PASSWORD_MAX_LENGTH = LIMITS.password.max;

export const validationKeys = {
  required: "web.forms.validation.required",
  emailInvalid: "web.forms.validation.email_invalid",
  passwordMin: "web.forms.validation.password_min",
  passwordMax: "web.forms.validation.password_max",
  passwordMismatch: "web.forms.validation.password_mismatch",
  termsRequired: "web.forms.validation.terms_required",
  tooShort: "web.forms.validation.too_short",
  // `too_long` keeps the long-standing `max_length` copy on purpose: the bound is
  // already carried in the field's maxLength, and the message has been shipped.
  tooLong: "web.forms.validation.max_length",
  invalidFormat: "web.forms.validation.invalid_format",
  notANumber: "web.forms.validation.not_a_number",
  outOfRange: "web.forms.validation.out_of_range",
  tooManyDecimals: "web.forms.validation.too_many_decimals",
  invalidDate: "web.forms.validation.invalid_date",
  unsupportedType: "web.forms.validation.unsupported_type",
  tooLarge: "web.forms.validation.too_large",
} as const;

/** Fallback copy for every rule code, so no failure can render as blank. */
const KEY_BY_CODE: Record<ValidationCode, string> = {
  required: validationKeys.required,
  too_short: validationKeys.tooShort,
  too_long: validationKeys.tooLong,
  invalid_format: validationKeys.invalidFormat,
  not_a_number: validationKeys.notANumber,
  out_of_range: validationKeys.outOfRange,
  too_many_decimals: validationKeys.tooManyDecimals,
  invalid_date: validationKeys.invalidDate,
  unsupported_type: validationKeys.unsupportedType,
  too_large: validationKeys.tooLarge,
};

/** Per-field overrides, for codes whose generic copy reads wrong on that field. */
export type MessageOverrides = Partial<Record<ValidationCode, string>>;

export function messageKeyFor(code: ValidationCode, overrides?: MessageOverrides): string {
  return overrides?.[code] ?? KEY_BY_CODE[code];
}

/**
 * Adapts a core rule to a zod refinement, mapping its code to a key.
 *
 * The rule is the ONLY judge: zod does not re-implement bounds, so a rule change
 * lands in both clients at once.
 */
export function refineWithRule(
  rule: (value: string) => ValidationResult,
  overrides?: MessageOverrides,
) {
  return (value: string, ctx: z.RefinementCtx): void => {
    const result = rule(value);
    if (!result.valid) {
      ctx.addIssue({ code: "custom", message: messageKeyFor(result.issue.code, overrides) });
    }
  };
}

/**
 * A required text field bounded like the API bounds it.
 *
 * `.trim()` runs BEFORE the rule, so the value zod hands on is the same one the
 * rule measured — the server counts raw bytes and would otherwise reject a value
 * the form approved.
 */
export function zText(bounds: LengthBounds, overrides?: MessageOverrides) {
  return z.string().trim().superRefine(refineWithRule((value) => coreText(value, bounds), overrides));
}

/** An email field: shape failure reads as "invalid email", not "invalid format". */
export function zEmailAddress() {
  return z
    .string()
    .trim()
    .superRefine(refineWithRule((value) => coreEmail(value), { invalid_format: validationKeys.emailInvalid }));
}

/**
 * A password field. Deliberately NOT trimmed: leading and trailing spaces are
 * characters the user chose, and the rule treats them as such.
 */
export function zPassword() {
  return z.string().superRefine(
    refineWithRule((value) => corePassword(value), {
      too_short: validationKeys.passwordMin,
      too_long: validationKeys.passwordMax,
    }),
  );
}

/**
 * A phone field using the shared rule (digits 7–15, plus the stored cap).
 *
 * STRICTER than the API, which only checks `max=20` — checked against every
 * stored number before adopting it, all of which fall inside these bounds.
 */
export function zPhone() {
  return z.string().trim().superRefine(refineWithRule((value) => corePhone(value)));
}
