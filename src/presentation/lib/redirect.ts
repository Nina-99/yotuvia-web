import { ROUTES } from "@/presentation/lib/routes";

/**
 * Resolves where to send the visitor after a successful login.
 *
 * Route guards store the attempted location under `state.from`, so the login
 * page can restore it. The value crosses a navigation boundary, which means it
 * is untrusted input: only an internal pathname is accepted, and the login
 * route itself is ignored to avoid a redirect loop.
 */
export function resolveRedirectPath(state: unknown, fallback: string = ROUTES.appHome): string {
  if (typeof state !== "object" || state === null) return fallback;

  const from = (state as { from?: unknown }).from;
  if (typeof from !== "object" || from === null) return fallback;

  const pathname = (from as { pathname?: unknown }).pathname;
  if (typeof pathname !== "string") return fallback;
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return fallback;
  if (pathname === ROUTES.login) return fallback;

  return pathname;
}
