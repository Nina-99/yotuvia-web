import { z } from "zod";
import type { ClientProfile } from "yotuvia-core";

import { validationKeys } from "./validation";

/**
 * Client self-service profile schema.
 *
 * Rules mirror the API contract (`yotuvia-api`):
 * - `UpdateClientRequest` validates `first_name`, `last_name`, `username`,
 *   `email` and `phone` as `required`, and the Go service APPLIES a field only
 *   when it is non-empty. Every field is therefore required here too: clearing
 *   one is not expressible through `PUT /client/:id`.
 * - Lengths come from `models/client.model.go` (50/50/50/20/70). The DB would
 *   truncate or reject longer values, so the form refuses them first.
 *
 * Messages are i18n keys rendered by `<FormError>`/`<FormAlert>`, never literals.
 */

export const CLIENT_FIRST_NAME_MAX = 50;
export const CLIENT_LAST_NAME_MAX = 50;
export const CLIENT_USERNAME_MAX = 50;
export const CLIENT_PHONE_MAX = 20;
export const CLIENT_EMAIL_MAX = 70;

/** Generic "too long" copy; the exact bound is enforced by the schema. */
const maxLengthKey = "web.forms.validation.max_length";

export const clientProfileSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, validationKeys.required)
    .max(CLIENT_FIRST_NAME_MAX, maxLengthKey),
  lastName: z
    .string()
    .trim()
    .min(1, validationKeys.required)
    .max(CLIENT_LAST_NAME_MAX, maxLengthKey),
  username: z
    .string()
    .trim()
    .min(1, validationKeys.required)
    .max(CLIENT_USERNAME_MAX, maxLengthKey),
  email: z
    .string()
    .trim()
    .min(1, validationKeys.required)
    .max(CLIENT_EMAIL_MAX, maxLengthKey)
    .pipe(z.email(validationKeys.emailInvalid)),
  phone: z
    .string()
    .trim()
    .min(1, validationKeys.required)
    .max(CLIENT_PHONE_MAX, maxLengthKey),
});

export type ClientProfileFormValues = z.infer<typeof clientProfileSchema>;

/** Seeds the form from the server payload (never the reverse). */
export function clientProfileToFormValues(profile: ClientProfile): ClientProfileFormValues {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    username: profile.username,
    email: profile.email,
    phone: profile.phone,
  };
}
