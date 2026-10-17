import { z } from "zod";

import {
  LIMITS,
  type AcceptInvitationData,
  type CreatePersonnelData,
  type Personnel,
  type UpdatePersonnelData,
} from "yotuvia-core";

import { validationKeys, zEmailAddress, zPassword, zText } from "./validation";

/**
 * Staff form schemas.
 *
 * The BOUNDS and RULES come from `yotuvia-core`; only the i18n KEYS live here,
 * so mobile validates these fields identically. `CreatePersonnelRequest` (used by
 * `POST /auth/register-personnel`) requires first name, last name, email and
 * phone (`max=20`) plus a password of 8–255 characters; `UpdatePersonnelRequest`
 * marks every field optional and never requires a password.
 *
 * There is NO password field in the edit flow on purpose: the core
 * `UpdatePersonnelData` contract (and `ApiPersonnelRepository.update`) does not
 * carry one, so a password typed there would be silently dropped. Changing a
 * password is out of reach from the web admin today (documented in the apply
 * report).
 */

export const personnelValidationKeys = {
  firstNameTooLong: "web.app.personnel.form.errors.first_name_too_long",
  lastNameTooLong: "web.app.personnel.form.errors.last_name_too_long",
  emailTooLong: "web.app.personnel.form.errors.email_too_long",
  phoneTooLong: "web.app.personnel.form.errors.phone_too_long",
} as const;

/** API limits (`CreatePersonnelRequest` / `UpdatePersonnelRequest`). */
export const PERSONNEL_NAME_MAX = LIMITS.personName.max;
export const PERSONNEL_EMAIL_MAX = LIMITS.email.max;
export const PERSONNEL_PHONE_MAX = LIMITS.phone.max;

const firstNameField = zText(LIMITS.personName, {
  overrides: { too_long: personnelValidationKeys.firstNameTooLong },
});

const lastNameField = zText(LIMITS.personName, {
  overrides: { too_long: personnelValidationKeys.lastNameTooLong },
});

/**
 * Email: required first, then the shape — the shared rule reports `required`
 * before it ever looks at the shape, so the two never fire at once.
 */
const emailField = zEmailAddress({
  overrides: { too_long: personnelValidationKeys.emailTooLong },
});

const phoneField = zText(LIMITS.phone, {
  overrides: { too_long: personnelValidationKeys.phoneTooLong },
});

const personnelFormShape = {
  firstName: firstNameField,
  lastName: lastNameField,
  email: emailField,
  phone: phoneField,
};

/** Create form: the API asks for a password of 8–255 characters. */
export const createPersonnelSchema = z.object({
  ...personnelFormShape,
  password: zPassword(),
});

/**
 * Update form. The `password` key stays in the shape so both flows share one
 * form-values type, but the edit UI never renders it and the payload mapper
 * never sends it.
 */
export const updatePersonnelSchema = z.object({
  ...personnelFormShape,
  password: z.string(),
});

/** Both schemas share this shape (only the validation rules differ). */
export type PersonnelFormValues = z.infer<typeof createPersonnelSchema>;

/** Invitation form: `POST /personnel/invitations` binds `required,email`. */
export const invitationSchema = z.object({
  email: emailField,
});

export type InvitationFormValues = z.infer<typeof invitationSchema>;

/**
 * Invitee acceptance form (`POST /personnel/accept-invite`).
 *
 * Mirrors the core `AcceptInvitationUseCase` contract and the API DTO: first and
 * last name are required, phone is OPTIONAL (`binding` has no `required`), and
 * the password is the account-creation bound of 8–255 characters. The
 * confirmation must match before any request leaves the browser.
 */
export const acceptInvitationSchema = z
  .object({
    firstName: firstNameField,
    lastName: lastNameField,
    phone: zText(LIMITS.phone, {
      optional: true,
      overrides: { too_long: personnelValidationKeys.phoneTooLong },
    }),
    password: zPassword(),
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

export type AcceptInvitationFormValues = z.infer<typeof acceptInvitationSchema>;

export const EMPTY_JOIN_FORM: AcceptInvitationFormValues = {
  firstName: "",
  lastName: "",
  phone: "",
  password: "",
  confirmPassword: "",
};

export function personnelToFormValues(personnel: Personnel): PersonnelFormValues {
  return {
    firstName: personnel.firstName,
    lastName: personnel.lastName,
    email: personnel.email,
    phone: personnel.phone ?? "",
    password: "",
  };
}

export const EMPTY_PERSONNEL_FORM: PersonnelFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
};

export const EMPTY_INVITATION_FORM: InvitationFormValues = { email: "" };

/** Maps validated create values onto the `CreatePersonnelData` contract. */
export function toCreatePersonnelData(
  values: PersonnelFormValues,
  centerId: number,
): CreatePersonnelData {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
    password: values.password,
    beautyCenterId: centerId,
  };
}

/** Maps validated update values onto the `UpdatePersonnelData` contract. */
export function toUpdatePersonnelData(values: PersonnelFormValues): UpdatePersonnelData {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
  };
}

/** Maps validated acceptance values onto the `AcceptInvitationData` contract. */
export function toAcceptInvitationData(
  values: AcceptInvitationFormValues,
  token: string,
): AcceptInvitationData {
  return {
    token,
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    phone: values.phone.trim(),
    password: values.password,
  };
}
