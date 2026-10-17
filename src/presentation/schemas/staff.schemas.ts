import { z } from "zod";
import { LIMITS, type StaffProfile, type UpdateStaffProfileData } from "yotuvia-core";

import { zOptionalPassword, zText } from "./validation";

/**
 * Staff self-service profile schema.
 *
 * The BOUNDS and RULES are no longer retyped here — they come from
 * `yotuvia-core`, so mobile validates these fields identically.
 *
 * Contract kept from the API:
 * - `PATCH /personnel/me` accepts ONLY `first_name`, `last_name`, `phone`,
 *   `password` and `images` (the allow-listed `UpdateMePersonnelRequest`).
 *   Identity fields (`email`, `is_active`, `beauty_center_id`) are rejected
 *   server-side with a 403, so they are NOT part of this schema and the page
 *   renders them read-only.
 *
 * Messages are i18n keys rendered by `<FormError>`/`<FormAlert>`, never literals.
 */

/** Kept as named exports: the form reads them for each input's `maxLength`. */
export const STAFF_FIRST_NAME_MAX = LIMITS.personName.max;
export const STAFF_LAST_NAME_MAX = LIMITS.personName.max;
export const STAFF_PHONE_MAX = LIMITS.phone.max;

export const staffProfileSchema = z.object({
  firstName: zText(LIMITS.personName),
  lastName: zText(LIMITS.personName),
  /**
   * Required and capped at the column width, but NOT checked as a phone SHAPE.
   *
   * The client form adopted the strict digit rule (7–15 digits); staff did not,
   * and the two now differ by more than a message. Tightening this one would
   * reject a stored number this screen has always accepted, so the behaviour is
   * preserved until the stored values are checked — the shared rule is there to
   * adopt the moment they are (`zPhone()`).
   */
  phone: zText(LIMITS.phone),
  /** Optional: empty keeps the current password (the API applies it only when set). */
  password: zOptionalPassword(),
});

export type StaffProfileFormValues = z.infer<typeof staffProfileSchema>;

/** Seeds the form from the server payload (never the reverse). */
export function staffProfileToFormValues(profile: StaffProfile): StaffProfileFormValues {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
    password: "",
  };
}

/**
 * Builds the allow-listed update payload.
 *
 * Only NON-EMPTY fields are sent (the API applies a field only when present),
 * and the password is only included when the user typed a new one. Identity
 * fields are structurally impossible to add: the return type is
 * `UpdateStaffProfileData`.
 */
export function staffProfileToUpdateData(
  values: StaffProfileFormValues,
): UpdateStaffProfileData {
  const data: UpdateStaffProfileData = {};
  if (values.firstName.trim() !== "") data.firstName = values.firstName.trim();
  if (values.lastName.trim() !== "") data.lastName = values.lastName.trim();
  if (values.phone.trim() !== "") data.phone = values.phone.trim();
  if (values.password !== "") data.password = values.password;
  return data;
}
