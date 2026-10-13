import { z } from "zod";

import { validationKeys } from "./validation";

/**
 * Booking-flow schemas.
 *
 * The flow is not a single `react-hook-form`: it is a wizard whose steps gate
 * each other (no services -> no slots; no slot -> nothing to confirm). Each step
 * is validated with the matching slice of `bookingDraftSchema` so the rules are
 * declared ONCE and the UI only maps failures to i18n keys.
 *
 * Message rule (same as every other schema in this folder): messages are i18n
 * keys, never literals.
 */

/** Local calendar day, as the API expects it. */
export const BOOKING_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 24h `HH:MM` slot start, as the API expects it. */
export const BOOKING_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const bookingDraftSchema = z.object({
  /** Center service ids; at least one is required to search or to book. */
  serviceIds: z
    .array(z.number().int().positive())
    .min(1, "web.centers.booking.required_services")
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "web.centers.booking.required_services",
    }),
  date: z.string().regex(BOOKING_DATE_PATTERN, validationKeys.required),
  startTime: z.string().regex(BOOKING_TIME_PATTERN, validationKeys.required),
  /** `null` means "any professional": the server assigns one. */
  personnelId: z.number().int().positive().nullable(),
});

export type BookingDraft = z.infer<typeof bookingDraftSchema>;

/** Step 1: the visitor must pick at least one service. */
export const bookingServicesSchema = bookingDraftSchema.pick({ serviceIds: true });

/** Step 2: a real day and a slot start are required before confirming. */
export const bookingSlotSchema = bookingDraftSchema.pick({
  date: true,
  startTime: true,
});

export type BookingServicesValues = z.infer<typeof bookingServicesSchema>;
export type BookingSlotValues = z.infer<typeof bookingSlotSchema>;
