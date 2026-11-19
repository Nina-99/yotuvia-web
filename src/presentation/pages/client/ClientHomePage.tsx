import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { CenterCard, UpcomingReservationCard } from "@/presentation/components/client";
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/presentation/components/ui";
import { useAuthSession } from "@/presentation/hooks/use-auth-session";
import { useTopRatedCenters } from "@/presentation/hooks/use-beauty-centers";
import { useClientUpcomingReservation } from "@/presentation/hooks/use-client";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { useErrorMessage } from "@/presentation/lib/errors";
import { ROUTES } from "@/presentation/lib/routes";

/** How many ranked centers the home shows before sending the client to browse. */
export const CLIENT_HOME_CENTERS_LIMIT = 6;

/**
 * Signed-in client's landing page.
 *
 * Three blocks, each with its own loading skeleton, empty state and error+retry
 * so one failing request never blanks the page:
 * 1. the next appointment (`getUpcomingReservationUseCase`);
 * 2. entry points to the client's reservations and favorites;
 * 3. top-rated centers to browse (`getTopRatedCentersUseCase`).
 *
 * `nearby` centers are NOT shown: they need coordinates and the web has no
 * geolocation seam yet (the mobile home asks for the device location), so the
 * ranked list is used instead of inventing a location.
 */
export function ClientHomePage() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t("client.home.meta_title"));

  const { user } = useAuthSession();
  const clientId = Number(user?.id ?? 0);
  const language = i18n.resolvedLanguage ?? i18n.language;

  const upcomingQuery = useClientUpcomingReservation(clientId);
  const centersQuery = useTopRatedCenters(CLIENT_HOME_CENTERS_LIMIT);

  const upcomingError = useErrorMessage(
    upcomingQuery.error,
    "web.errors.client_reservations_fetch",
  );
  const centersError = useErrorMessage(centersQuery.error, "web.errors.client_centers_fetch");

  if (clientId <= 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("client.home.error_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-muted">{t("client.home.no_client")}</p>
        </CardContent>
      </Card>
    );
  }

  const firstName = user?.firstName?.trim();

  return (
    <div className="flex flex-col gap-6">
      <h2 className="ytv-display text-3xl font-bold text-text">
        {firstName
          ? t("client.home.greeting", { name: firstName })
          : t("client.home.title")}
      </h2>

      <section className="flex flex-col gap-3" aria-labelledby="client-home-upcoming">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="client-home-upcoming" className="text-lg font-semibold text-text">
            {t("client.home.upcomingReservation")}
          </h3>
          <Link
            to={ROUTES.client.reservations}
            className="text-sm font-semibold text-link underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t("client.home.view_all")}
          </Link>
        </div>

        {upcomingQuery.isPending ? (
          <div
            role="status"
            aria-live="polite"
            aria-label={t("common.loading")}
            className="flex flex-col gap-2"
          >
            <Skeleton className="h-40 w-full" />
          </div>
        ) : upcomingQuery.isError ? (
          <Card role="alert">
            <CardContent className="flex flex-col gap-3 p-4">
              <p className="text-sm text-text-muted">{upcomingError}</p>
              <Button
                variant="outline"
                className="self-start"
                onClick={() => void upcomingQuery.refetch()}
              >
                {t("common.retry")}
              </Button>
            </CardContent>
          </Card>
        ) : upcomingQuery.data ? (
          <UpcomingReservationCard reservation={upcomingQuery.data} language={language} />
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
              <p className="text-sm font-semibold text-text">{t("client.home.no_upcoming")}</p>
              <p className="text-xs text-text-muted">{t("client.home.no_upcoming_body")}</p>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2" aria-label={t("client.home.quick_links")}>
        <Card>
          <CardContent className="flex flex-col gap-2 p-4">
            <h3 className="text-sm font-semibold text-text">
              {t("web.app.nav.client_reservations")}
            </h3>
            <p className="text-xs text-text-secondary">{t("client.home.reservations_hint")}</p>
            <Link
              to={ROUTES.client.reservations}
              className="mt-auto inline-flex items-center self-start rounded-lg text-sm font-semibold text-link underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t("client.home.view_all")}
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-2 p-4">
            <h3 className="text-sm font-semibold text-text">
              {t("web.app.nav.client_favorites")}
            </h3>
            <p className="text-xs text-text-secondary">{t("client.home.favorites_hint")}</p>
            <Link
              to={ROUTES.client.favorites}
              className="mt-auto inline-flex items-center self-start rounded-lg text-sm font-semibold text-link underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t("client.home.view_all")}
            </Link>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="client-home-centers">
        <h3 id="client-home-centers" className="text-lg font-semibold text-text">
          {t("client.home.top_rated")}
        </h3>

        {centersQuery.isPending ? (
          <div
            role="status"
            aria-live="polite"
            aria-label={t("common.loading")}
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          >
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-32 w-full" />
            ))}
          </div>
        ) : centersQuery.isError ? (
          <Card role="alert">
            <CardContent className="flex flex-col gap-3 p-4">
              <p className="text-sm text-text-muted">{centersError}</p>
              <Button
                variant="outline"
                className="self-start"
                onClick={() => void centersQuery.refetch()}
              >
                {t("common.retry")}
              </Button>
            </CardContent>
          </Card>
        ) : centersQuery.data.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-1 p-6 text-center">
              <p className="text-sm font-semibold text-text">{t("client.home.no_results")}</p>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {centersQuery.data.map((center) => (
              <li key={center.id}>
                <CenterCard center={center} language={language} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
