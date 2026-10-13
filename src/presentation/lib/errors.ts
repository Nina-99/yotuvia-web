import type { UseMutationResult } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

/**
 * Maps thrown errors (use-case validation errors, Axios transport failures,
 * unknown throwables) to i18n keys under the `web.errors` namespace.
 *
 * The mapping is intentionally shallow: HTTP status codes are the only
 * reliable cross-repository contract, so anything unrecognized falls back to a
 * caller-provided key. UI code translates the key with `useErrorMessage` or
 * stores it via `attachErrorKey` on mutations.
 */

/** Fallback used when an error carries no usable status or shape. */
export const ERROR_FALLBACK_KEY = "web.errors.unknown";

const STATUS_ERROR_KEYS: Readonly<Record<number, string>> = {
  400: "web.errors.validation",
  401: "web.errors.unauthorized",
  403: "web.errors.forbidden",
  404: "web.errors.not_found_resource",
  409: "web.errors.conflict",
  422: "web.errors.validation",
  429: "web.errors.rate_limited",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Extracts an HTTP status from a direct `status`, an Axios response, or the body. */
export function getErrorStatus(error: unknown): number | undefined {
  if (!isRecord(error)) return undefined;

  if (typeof error.status === "number") return error.status;

  const response = error.response;
  if (isRecord(response) && typeof response.status === "number") {
    return response.status;
  }

  return undefined;
}

/** True when the failure never reached the server (offline, DNS, CORS, timeout). */
export function isNetworkError(error: unknown): boolean {
  if (!isRecord(error)) return false;
  if (error.code === "ERR_NETWORK") return true;
  const message = error.message;
  return typeof message === "string" && /network error/i.test(message);
}

/**
 * Resolves the i18n key for an error.
 *
 * @param error       Any thrown value.
 * @param fallbackKey Key returned when the error cannot be classified.
 */
export function toErrorKey(error: unknown, fallbackKey: string = ERROR_FALLBACK_KEY): string {
  if (error == null) return fallbackKey;
  if (isNetworkError(error)) return "web.errors.network";

  const status = getErrorStatus(error);
  if (status !== undefined) {
    if (status in STATUS_ERROR_KEYS) return STATUS_ERROR_KEYS[status];
    if (status >= 500) return "web.errors.server";
    return fallbackKey;
  }

  return fallbackKey;
}

/** Translates an error into a user-facing message, or `null` when there is none. */
export function useErrorMessage(
  error: unknown,
  fallbackKey: string = ERROR_FALLBACK_KEY,
): string | null {
  const { t } = useTranslation();
  if (error == null) return null;
  return t(toErrorKey(error, fallbackKey));
}

/** A mutation result augmented with the resolved i18n error key. */
export type MutationWithErrorKey<TData, TError, TVariables, TContext> = UseMutationResult<
  TData,
  TError,
  TVariables,
  TContext
> & {
  /** i18n key for the current failure, or `null` while the mutation has not failed. */
  errorKey: string | null;
};

/**
 * Normalizes a mutation's error into an i18n key without coupling the hook to
 * the toast layer: consumers decide how to present `errorKey`.
 */
export function attachErrorKey<TData, TError, TVariables, TContext>(
  mutation: UseMutationResult<TData, TError, TVariables, TContext>,
  fallbackKey: string,
): MutationWithErrorKey<TData, TError, TVariables, TContext> {
  return {
    ...mutation,
    errorKey: mutation.error == null ? null : toErrorKey(mutation.error, fallbackKey),
  };
}
