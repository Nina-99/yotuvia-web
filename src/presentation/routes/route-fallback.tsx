import { useTranslation } from "react-i18next";

import { Skeleton } from "@/presentation/components/ui";

/**
 * Full-page placeholder shown while the session is being hydrated.
 *
 * Rendering it (instead of redirecting early) is what keeps a valid session
 * from flickering through the login page on a hard refresh.
 */
export function RouteFallback() {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={t("common.loading")}
      className="ytv-ambient flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4"
    >
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64" />
    </div>
  );
}
