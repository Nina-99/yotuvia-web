import { z } from "zod";
import {
  LIMITS,
  decimal as coreDecimal,
  email as coreEmail,
  integer as coreInteger,
  isoDate as coreIsoDate,
  parseAmount,
  password as corePassword,
  phone as corePhone,
  text as coreText,
  type AmountBounds,
  type DateBounds,
  type LengthBounds,
  type NumberBounds,
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
 * A text field bounded like the API bounds it.
 *
 * `.trim()` runs BEFORE the rule, so the value zod hands on is the same one the
 * rule measured — the server counts raw bytes and would otherwise reject a value
 * the form approved. Required unless `options.optional` says otherwise.
 */
export function zText(bounds: LengthBounds, options: FieldOptions = {}) {
  return z.string().trim().superRefine(refineField((value) => coreText(value, bounds), options));
}

/** An email field: shape failure reads as "invalid email", not "invalid format". */
export function zEmailAddress(options: FieldOptions = {}) {
  return z.string().trim().superRefine(
    refineField((value) => coreEmail(value), {
      ...options,
      overrides: { invalid_format: validationKeys.emailInvalid, ...options.overrides },
    }),
  );
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

/**
 * Options for the rules below, which — unlike `zText` — accept an empty value.
 *
 * `optional` exists because the API applies many fields only when they are
 * present (`omitempty`): clearing one is a legitimate no-op, so the rule must not
 * report `required` for a field the server would simply skip. Validation then
 * applies to the typed value alone.
 */
export interface FieldOptions {
  overrides?: MessageOverrides;
  optional?: boolean;
}

/** Empty after trim — exactly the value a `required` rule would reject. */
function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

/** Runs a rule and maps its code, honouring `optional` for a blank value. */
function refineField(
  rule: (value: string) => ValidationResult,
  options: FieldOptions,
) {
  return (value: string, ctx: z.RefinementCtx): void => {
    if (options.optional && isBlank(value)) return;
    const result = rule(value);
    if (!result.valid) {
      ctx.addIssue({ code: "custom", message: messageKeyFor(result.issue.code, options.overrides) });
    }
  };
}

/** A whole number (minutes, steps, quantities), bounded like the API bounds it. */
export function zInteger(bounds: NumberBounds = {}, options: FieldOptions = {}) {
  return z.string().trim().superRefine(refineField((value) => coreInteger(value, bounds), options));
}

/**
 * A decimal that is NOT money (coordinates, ratios).
 *
 * Canonical shape only: `1.234` here is one-point-two-three-four, never a
 * thousands grouping. Formatted amounts go through `zAmount`.
 */
export function zDecimal(
  bounds: NumberBounds & { maxDecimals?: number } = {},
  options: FieldOptions = {},
) {
  return z.string().trim().superRefine(refineField((value) => coreDecimal(value, bounds), options));
}

/**
 * A money field, read the way the viewer typed it.
 *
 * Build the payload with `amountFromField`, never `Number`/`parseFloat`: the rule
 * understands `1.234,56` as 1234.56, and a second parser would read it as 1.234.
 */
export function zAmount(bounds: AmountBounds = {}, options: FieldOptions = {}) {
  return z.string().trim().superRefine(refineField((value) => parseAmount(value, bounds), options));
}

/** The value a money field should send, read by the rule that validated it. */
export function amountFromField(value: string, bounds: AmountBounds = {}): number {
  return parseAmount(value, bounds).value ?? 0;
}

/** The value a whole-number field should send, read by the rule that validated it. */
export function integerFromField(value: string, bounds: NumberBounds = {}): number {
  return coreInteger(value, bounds).value ?? 0;
}

/** The value a decimal field should send, read by the rule that validated it. */
export function decimalFromField(
  value: string,
  bounds: NumberBounds & { maxDecimals?: number } = {},
): number {
  return coreDecimal(value, bounds).value ?? 0;
}

/** A real calendar day (`YYYY-MM-DD`); a day that does not exist is rejected here. */
export function zIsoDate(bounds: DateBounds = {}, options: FieldOptions = {}) {
  return z.string().trim().superRefine(refineField((value) => coreIsoDate(value, bounds), options));
}

/**
 * A password field the user may leave EMPTY to keep the current one.
 *
 * Emptiness is checked on the raw value, not the trimmed one: a password is
 * taken literally, and `" "` is a one-character password the rule must judge, not
 * an absent field. Deliberately not trimmed, for the same reason.
 */
export function zOptionalPassword(): z.ZodString {
  return z.string().superRefine((value, ctx) => {
    if (value.length === 0) return;
    const result = corePassword(value);
    if (!result.valid) {
      ctx.addIssue({
        code: "custom",
        message: messageKeyFor(result.issue.code, {
          too_short: validationKeys.passwordMin,
          too_long: validationKeys.passwordMax,
        }),
      });
    }
  });
}
