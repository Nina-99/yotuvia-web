import { z } from "zod";
import { LIMITS, type ClientProfile } from "yotuvia-core";

import { zEmailAddress, zPhone, zText } from "./validation";

/**
 * Client self-service profile schema.
 *
 * The BOUNDS are no longer retyped here — they come from `yotuvia-core`'s
 * `LIMITS`, which mirrors the Go request DTOs and the model columns (50/50/50/20/70).
 * The RULES are the shared ones, so mobile validates these fields identically.
 *
 * Required-ness stays: `UpdateClientRequest` validates every identity field as
 * `required` and the Go service APPLIES a field only when it is non-empty, so
 * clearing one is not expressible through `PUT /client/:id`.
 *
 * Messages are i18n keys rendered by `<FormError>`/`<FormAlert>`, never literals.
 */

/** Kept as named exports: the form reads them for each input's `maxLength`. */
export const CLIENT_FIRST_NAME_MAX = LIMITS.personName.max;
export const CLIENT_LAST_NAME_MAX = LIMITS.personName.max;
export const CLIENT_USERNAME_MAX = LIMITS.username.max;
export const CLIENT_PHONE_MAX = LIMITS.phone.max;
export const CLIENT_EMAIL_MAX = LIMITS.email.max;

export const clientProfileSchema = z.object({
  firstName: zText(LIMITS.personName),
  lastName: zText(LIMITS.personName),
  username: zText(LIMITS.username),
  email: zEmailAddress(),
  phone: zPhone(),
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
