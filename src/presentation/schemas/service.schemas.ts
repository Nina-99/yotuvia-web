import { z } from "zod";
import {
  DEFAULT_LANGUAGE,
  baseTranslation,
  compactTranslation,
  emptyTranslationMap,
  fullTranslation,
  hasAnyTranslation,
} from "yotuvia-core";
import type {
  CreateCategoryData,
  CreateServiceData,
  Service,
  UpdateServiceData,
} from "yotuvia-core";

import { validationKeys } from "./validation";

/**
 * Service and category form schemas (multi-language, DYNAMIC).
 *
 * Translations are stored as `{ [locale]: value }` maps keyed by the language
 * registry (`LANGUAGES`). Adding a locale to the registry automatically adds an
 * input to every owner form — no per-language key/column changes here. The API
 * stores a canonical base value plus the same map; the `to*Data` helpers derive
 * the base from the first non-empty language (registry order) and build the map.
 *
 * Rules mirror the API DTOs:
 * - `CreateServiceRequest`: base name `required,min=2,max=100`; category
 *   required; duration `required,gt=0`; price `required,gte=0`; base
 *   description `required`. Create demands a description, update does not.
 * - `UpdateServiceRequest`: name `omitempty,min=2`, duration `omitempty,gt=0`.
 * - `CreateCategoryRequest`: base name `required,min=3`.
 */

export const serviceValidationKeys = {
  nameTooShort: "web.app.services.form.errors.name_too_short",
  nameTooLong: "web.app.services.form.errors.name_too_long",
  descriptionTooLong: "web.app.services.form.errors.description_too_long",
  durationInvalid: "web.app.services.form.errors.duration_invalid",
  priceInvalid: "web.app.services.form.errors.price_invalid",
  imageInvalid: "web.app.services.form.errors.image_invalid",
  categoryRequired: "web.app.services.form.errors.category_required",
  categoryNameTooShort: "web.app.services.category_form.errors.name_too_short",
  categoryNameTooLong: "web.app.services.category_form.errors.name_too_long",
  categoryDescriptionTooLong: "web.app.services.category_form.errors.description_too_long",
} as const;

/** API limits (`CreateServiceRequest` / `CreateCategoryRequest`). */
export const SERVICE_NAME_MIN = 2;
export const SERVICE_NAME_MAX = 100;
export const SERVICE_DESCRIPTION_MAX = 500;
export const SERVICE_DURATION_MAX = 600;
export const CATEGORY_NAME_MIN = 3;
export const CATEGORY_NAME_MAX = 100;
export const CATEGORY_DESCRIPTION_MAX = 255;
const IMAGE_URL_MAX = 255;

/**
 * A translation map: any locale key → string. Values are trimmed; a non-empty
 * value must respect `min`/`max`. Empty is allowed (a translation is optional);
 * the form-level refine requires at least ONE language to be filled.
 */
function translationMapValue(min: number, tooShort: string, max: number, tooLong: string) {
  return z
    .string()
    .trim()
    .max(max, tooLong)
    .refine((value) => value === "" || value.length >= min, { message: tooShort });
}

const descriptionMapValue = z
  .string()
  .trim()
  .max(SERVICE_DESCRIPTION_MAX, serviceValidationKeys.descriptionTooLong);

const durationField = z
  .string()
  .trim()
  .min(1, validationKeys.required)
  .refine(
    (value) =>
      /^\d+$/.test(value) && Number(value) > 0 && Number(value) <= SERVICE_DURATION_MAX,
    { message: serviceValidationKeys.durationInvalid },
  );

const priceField = z
  .string()
  .trim()
  .min(1, validationKeys.required)
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), {
    message: serviceValidationKeys.priceInvalid,
  });

/**
 * Accepts an empty value, an absolute `http(s)` URL, or a root-relative path —
 * the three shapes the API returns and the mobile form accepts.
 */
const imageUrlField = z
  .string()
  .trim()
  .max(IMAGE_URL_MAX, serviceValidationKeys.imageInvalid)
  .refine((value) => value === "" || /^(https?:\/\/|\/)[^\s]*$/i.test(value), {
    message: serviceValidationKeys.imageInvalid,
  });

const serviceFormShape = {
  nameI18n: z.record(
    z.string(),
    translationMapValue(
      SERVICE_NAME_MIN,
      serviceValidationKeys.nameTooShort,
      SERVICE_NAME_MAX,
      serviceValidationKeys.nameTooLong,
    ),
  ),
  descriptionI18n: z.record(z.string(), descriptionMapValue),
  categoryId: z.string().min(1, serviceValidationKeys.categoryRequired),
  duration: durationField,
  price: priceField,
  imageUrl: imageUrlField,
  isActive: z.boolean(),
};

const requireAtLeastOneName = (
  values: { nameI18n: Record<string, string> },
  ctx: z.RefinementCtx,
) => {
  if (!hasAnyTranslation(values.nameI18n)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["nameI18n", DEFAULT_LANGUAGE],
      message: validationKeys.required,
    });
  }
};

/** Create form: the API requires a non-empty description too. */
export const createServiceSchema = z
  .object(serviceFormShape)
  .superRefine((values, ctx) => {
    requireAtLeastOneName(values, ctx);
    if (!hasAnyTranslation(values.descriptionI18n)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["descriptionI18n", DEFAULT_LANGUAGE],
        message: validationKeys.required,
      });
    }
  });

/** Update form: a missing/empty description is valid. */
export const updateServiceSchema = z.object(serviceFormShape).superRefine(requireAtLeastOneName);

/** Both schemas share this shape (only the validation rules differ). */
export type ServiceFormValues = z.infer<typeof createServiceSchema>;

/** Category create form (`POST /category`), multi-language. */
export const categoryFormSchema = z
  .object({
    nameI18n: z.record(
      z.string(),
      translationMapValue(
        CATEGORY_NAME_MIN,
        serviceValidationKeys.categoryNameTooShort,
        CATEGORY_NAME_MAX,
        serviceValidationKeys.categoryNameTooLong,
      ),
    ),
    descriptionI18n: z.record(
      z.string(),
      z.string().trim().max(CATEGORY_DESCRIPTION_MAX, serviceValidationKeys.categoryDescriptionTooLong),
    ),
  })
  .superRefine(requireAtLeastOneName);

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export const EMPTY_SERVICE_FORM: ServiceFormValues = {
  nameI18n: emptyTranslationMap(),
  descriptionI18n: emptyTranslationMap(),
  categoryId: "",
  duration: "30",
  price: "0",
  imageUrl: "",
  isActive: true,
};

export const EMPTY_CATEGORY_FORM: CategoryFormValues = {
  nameI18n: emptyTranslationMap(),
  descriptionI18n: emptyTranslationMap(),
};

/**
 * Pre-fills the service form from an existing service. The base `name`/
 * `description` lands in the default-language slot when no stored translation
 * exists, so editing never silently drops it.
 */
export function serviceToFormValues(service: Service): ServiceFormValues {
  return {
    nameI18n: fullTranslation(service.nameI18n, service.name),
    descriptionI18n: fullTranslation(service.descriptionI18n, service.description ?? ""),
    categoryId: String(service.categoryId),
    duration: String(service.duration),
    price: String(service.price),
    imageUrl: service.imageUrl ?? "",
    isActive: service.isActive ?? true,
  };
}

/** Maps validated create values onto the `CreateServiceData` contract. */
export function toCreateServiceData(
  values: ServiceFormValues,
  centerId: number,
): CreateServiceData {
  return {
    name: baseTranslation(values.nameI18n),
    nameI18n: compactTranslation(values.nameI18n),
    beautyCenterId: centerId,
    categoryId: Number(values.categoryId),
    duration: Number(values.duration),
    price: Number(values.price),
    description: baseTranslation(values.descriptionI18n),
    descriptionI18n: compactTranslation(values.descriptionI18n),
    imageUrl: values.imageUrl.trim(),
    isActive: values.isActive,
  };
}

/**
 * Maps validated update values onto the `UpdateServiceData` contract.
 *
 * `beautyCenterId` is intentionally omitted: the update DTO does not require it
 * and the service already belongs to a center.
 */
export function toUpdateServiceData(values: ServiceFormValues): UpdateServiceData {
  return {
    name: baseTranslation(values.nameI18n),
    nameI18n: compactTranslation(values.nameI18n),
    categoryId: Number(values.categoryId),
    duration: Number(values.duration),
    price: Number(values.price),
    description: baseTranslation(values.descriptionI18n),
    descriptionI18n: compactTranslation(values.descriptionI18n),
    imageUrl: values.imageUrl.trim(),
    isActive: values.isActive,
  };
}

/** Maps validated category values onto the `CreateCategoryData` contract. */
export function toCreateCategoryData(
  values: CategoryFormValues,
  centerId: number,
): CreateCategoryData {
  return {
    name: baseTranslation(values.nameI18n),
    nameI18n: compactTranslation(values.nameI18n),
    beautyCenterId: centerId,
    description: baseTranslation(values.descriptionI18n),
    descriptionI18n: compactTranslation(values.descriptionI18n),
  };
}
