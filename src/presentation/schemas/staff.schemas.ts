import { z } from "zod";
import type { StaffProfile, UpdateStaffProfileData } from "yotuvia-core";

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, validationKeys } from "./validation";

/**
 * Staff self-service profile schema.
 *
 * Rules mirror the API contract (`yotuvia-api` + `yotuvia-core`):
 * - `PATCH /personnel/me` accepts ONLY `first_name`, `last_name`, `phone`,
 *   `password` and `images` (the allow-listed `UpdateMePersonnelRequest`).
 *   Identity fields (`email`, `is_active`, `beauty_center_id`) are rejected
 *   server-side with a 403, so they are NOT part of this schema and the page
 *   renders them read-only.
 * - Lengths come from `models/personnel.model.go` (50/50/20); the password
 *   bounds mirror every account-creating DTO (8..255).
 *
 * Messages are i18n keys rendered by `<FormError>`/`<FormAlert>`, never literals.
 */

export const STAFF_FIRST_NAME_MAX = 50;
export const STAFF_LAST_NAME_MAX = 50;
export const STAFF_PHONE_MAX = 20;

/** Generic "too long" copy; the exact bound is enforced by the schema. */
const maxLengthKey = "web.forms.validation.max_length";

export const staffProfileSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, validationKeys.required)
    .max(STAFF_FIRST_NAME_MAX, maxLengthKey),
  lastName: z
    .string()
    .trim()
    .min(1, validationKeys.required)
    .max(STAFF_LAST_NAME_MAX, maxLengthKey),
  phone: z.string().trim().min(1, validationKeys.required).max(STAFF_PHONE_MAX, maxLengthKey),
  /** Optional: empty keeps the current password (the API applies it only when set). */
  password: z
    .string()
    .max(PASSWORD_MAX_LENGTH, validationKeys.passwordMax)
    .refine((value) => value === "" || value.length >= PASSWORD_MIN_LENGTH, {
      message: validationKeys.passwordMin,
    }),
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
