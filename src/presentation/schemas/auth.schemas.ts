import { z } from "zod";

import type { AppRole, RegisterData } from "yotuvia-core";

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, validationKeys } from "./validation";

/**
 * Validation rules mirror the `yotuvia-core` auth use-cases, which are the
 * single source of truth for both mobile and web:
 *
 * - Email must contain `@` (`LoginUserUseCase`, `RegisterUserUseCase`).
 * - Password is at least 8 characters (`LoginUserUseCase`, `RegisterUserUseCase`,
 *   `ResetPasswordUseCase`); the reset flow additionally caps it at 255.
 * - CLIENT registrations require first/last name and phone; BEAUTY_CENTER
 *   registrations require a business name and phone (`RegisterUserUseCase`).
 *
 * Messages are i18n keys rendered by `<FormError>` via `t(key, { defaultValue })`.
 */

// The shared vocabulary lives in `./validation` so sibling schemas (services,
// staff) reuse the same keys instead of chaining through this module.
export { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, validationKeys } from "./validation";

/** Supported self-serve registration roles (PERSONNEL joins via invitation). */
export const registrationRoles = ["CLIENT", "BEAUTY_CENTER"] as const;

export type RegistrationRole = (typeof registrationRoles)[number];

/** Email: required first, then RFC-shaped format — never both at once. */
const emailField = z
  .string()
  .trim()
  .min(1, validationKeys.required)
  .pipe(z.email(validationKeys.emailInvalid));

/** Password: required first, then length bounds in a second stage. */
const passwordField = z
  .string()
  .min(1, validationKeys.required)
  .pipe(
    z
      .string()
      .min(PASSWORD_MIN_LENGTH, validationKeys.passwordMin)
      .max(PASSWORD_MAX_LENGTH, validationKeys.passwordMax),
  );

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
    confirmPassword: z.string().min(1, validationKeys.required),
  })
  .superRefine((values, ctx) => {
    if (values.password !== values.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: validationKeys.passwordMismatch,
      });
    }
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export const registerSchema = z
  .object({
    role: z.enum(registrationRoles),
    email: emailField,
    password: passwordField,
    confirmPassword: z.string().min(1, validationKeys.required),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
    name: z.string().optional(),
    termsAccepted: z.boolean().refine((value) => value, {
      message: validationKeys.termsRequired,
    }),
  })
  .superRefine((values, ctx) => {
    if (values.password !== values.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: validationKeys.passwordMismatch,
      });
    }

    if (values.role === "CLIENT") {
      if (!values.firstName?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["firstName"],
          message: validationKeys.required,
        });
      }
      if (!values.lastName?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["lastName"],
          message: validationKeys.required,
        });
      }
      if (!values.phone?.trim()) {
        ctx.addIssue({ code: "custom", path: ["phone"], message: validationKeys.required });
      }
      return;
    }

    if (!values.name?.trim()) {
      ctx.addIssue({ code: "custom", path: ["name"], message: validationKeys.required });
    }
    if (!values.phone?.trim()) {
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
