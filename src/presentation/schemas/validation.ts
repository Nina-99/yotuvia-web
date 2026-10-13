/**
 * Shared validation vocabulary for presentation form schemas.
 *
 * Messages are i18n keys (never literals) so `<FormError>` renders translated
 * copy in both locales. The bounds mirror the `yotuvia-core` use-cases and the
 * API request DTOs (`data/request/*.request.go`), which stay the single source
 * of truth for both mobile and web.
 */

/** Password bounds: `required,min=8,max=255` on every account-creating DTO. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 255;

export const validationKeys = {
  required: "web.forms.validation.required",
  emailInvalid: "web.forms.validation.email_invalid",
  passwordMin: "web.forms.validation.password_min",
  passwordMax: "web.forms.validation.password_max",
  passwordMismatch: "web.forms.validation.password_mismatch",
  termsRequired: "web.forms.validation.terms_required",
} as const;
