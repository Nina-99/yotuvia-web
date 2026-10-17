import { z } from "zod";

import {
  isValid,
  passwordMatch,
  phone as corePhone,
  required,
  type AppRole,
  type RegisterData,
} from "yotuvia-core";

import {
  messageKeyFor,
  validationKeys,
  zEmailAddress,
  zPassword,
} from "./validation";

/**
 * Auth form schemas.
 *
 * The RULES come from `yotuvia-core` (shared with mobile); what lives here is
 * only how each failure is WORDED for the web. Bounds are no longer retyped:
 * they come from the core's `LIMITS`, mirrored from the Go request DTOs.
 *
 * Messages are i18n keys rendered by `<FormError>` via `t(key, { defaultValue })`.
 */

// The shared vocabulary lives in `./validation` so sibling schemas (services,
// staff) reuse the same keys instead of chaining through this module.
export {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validationKeys,
} from "./validation";

/** Supported self-serve registration roles (PERSONNEL joins via invitation). */
export const registrationRoles = ["CLIENT", "BEAUTY_CENTER"] as const;

export type RegistrationRole = (typeof registrationRoles)[number];

/** The core decides emptiness, so "  " is missing here exactly as it is there. */
const missing = (value?: string): boolean => !isValid(required(value ?? ""));

const emailField = zEmailAddress();

const passwordField = zPassword();

/** Confirmation is only ever checked for presence; the match is a form concern. */
const confirmField = z.string().min(1, validationKeys.required);

/** Compares two passwords through the shared rule, skipping the empty case. */
function checkPasswordMatch(password: string, confirm: string, ctx: z.RefinementCtx): void {
  // Empty already fails the field's own `required`; comparing it would report
  // the same problem twice.
  if (confirm.length === 0) return;
  if (!isValid(passwordMatch(password, confirm))) {
    ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: validationKeys.passwordMismatch });
  }
}

export const loginSchema = z.object({
  email: emailField,
  password: passwordField,
});

export type LoginFormValues = z.infer<typeof loginSchema>;

/** Email-only form used by the password-recovery and verification resend flows. */
export const forgotPasswordSchema = z.object({
  email: emailField,
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

/** New-password form used by the reset-password page (the token comes from the URL). */
export const resetPasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: confirmField,
  })
  .superRefine((values, ctx) => checkPasswordMatch(values.password, values.confirmPassword, ctx));

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export const registerSchema = z
  .object({
    role: z.enum(registrationRoles),
    email: emailField,
    password: passwordField,
    confirmPassword: confirmField,
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
    name: z.string().optional(),
    termsAccepted: z.boolean().refine((value) => value, {
      message: validationKeys.termsRequired,
    }),
  })
  .superRefine((values, ctx) => {
    checkPasswordMatch(values.password, values.confirmPassword, ctx);

    // A phone is optional overall but required for every role; when it IS given
    // it must still be a phone. Deliberately NO early return: a bad phone must
    // not swallow the role checks below.
    if (values.phone && !missing(values.phone)) {
      const failure = corePhone(values.phone);
      if (!failure.valid) {
        ctx.addIssue({
          code: "custom",
          path: ["phone"],
          message: failure.valid ? validationKeys.required : messageKeyFor(failure.issue.code),
        });
      }
    }

    if (values.role === "CLIENT") {
      for (const field of ["firstName", "lastName", "phone"] as const) {
        if (missing(values[field])) {
          ctx.addIssue({ code: "custom", path: [field], message: validationKeys.required });
        }
      }
      return;
    }

    if (missing(values.name)) {
      ctx.addIssue({ code: "custom", path: ["name"], message: validationKeys.required });
    }
    if (missing(values.phone)) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: validationKeys.required });
    }
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

/** Maps validated form values onto the core `RegisterData` contract. */
export function toRegisterData(values: RegisterFormValues): RegisterData {
  const role: AppRole = values.role;
  return {
    role,
    email: values.email,
    password: values.password,
    firstName: values.firstName?.trim() || undefined,
    lastName: values.lastName?.trim() || undefined,
    phone: values.phone?.trim() || undefined,
    name: values.name?.trim() || undefined,
    termsAccepted: values.termsAccepted,
  };
}
