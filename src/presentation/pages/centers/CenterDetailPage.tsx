import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import type { BeautyCenterImage, Service, SocialMedia, WorkingHour } from "yotuvia-core";

import { ReviewCard, ReviewForm } from "@/presentation/components/reviews";
import { LoyaltyProgramBadge } from "@/presentation/components/centers/LoyaltyProgramBadge";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Skeleton,
  buttonClasses,
  useToast,
} from "@/presentation/components/ui";
import { useAuthSession } from "@/presentation/hooks/use-auth-session";
import { useBeautyCenter } from "@/presentation/hooks/use-beauty-centers";
import { useAddClientFavorite, useClientFavorites, useRemoveClientFavorite } from "@/presentation/hooks/use-client";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { useCenterPersonnel } from "@/presentation/hooks/use-personnel";
import { useReviews } from "@/presentation/hooks/use-reviews";
import { useCanReview } from "@/presentation/hooks/use-write-review";
import { useClientServices } from "@/presentation/hooks/use-services";
import { useErrorMessage, getErrorStatus } from "@/presentation/lib/errors";
import { formatCurrency, formatNumber, formatRating, formatTime } from "@/presentation/lib/format";
import { CLIENT_APP_ROLES } from "@/presentation/lib/roles";
import { ROUTES, centerBookingPath } from "@/presentation/lib/routes";
import { PublicLayout } from "@/presentation/layouts/PublicLayout";

/** Networks the API models, in presentation order. */
type SocialNetwork = "instagram" | "facebook" | "tiktok" | "twitter" | "google";

/** i18n keys for the social networks. Brand names, not copy. */
const SOCIAL_KEYS: Readonly<Record<SocialNetwork, string>> = {
  google: "web.centers.detail.social_google",
  facebook: "web.centers.detail.social_facebook",
  instagram: "web.centers.detail.social_instagram",
  twitter: "web.centers.detail.social_twitter",
  tiktok: "web.centers.detail.social_tiktok",
};

const SOCIAL_ORDER: readonly SocialNetwork[] = [
  "instagram",
  "facebook",
  "tiktok",
  "twitter",
  "google",
];

interface SocialLink {
  network: SocialNetwork;
  url: string;
}

/** The center's non-empty social links, in a stable presentation order. */
function socialLinks(social: SocialMedia | null | undefined): SocialLink[] {
  if (!social) return [];
  return SOCIAL_ORDER.flatMap((network) => {
    const url = social[network]?.trim();
    return url ? [{ network, url }] : [];
  });
}

/** Gallery order: cover first, then the server's `position`. */
function orderedImages(images: readonly BeautyCenterImage[] = []): BeautyCenterImage[] {
  return [...images].sort((a, b) => {
    if (a.isCover !== b.isCover) return a.isCover ? -1 : 1;
    return a.position - b.position;
  });
}

/** Working hours grouped by weekday (0=Sun..6=Sat), each day ordered by start. */
function schedulesByDay(schedules: readonly WorkingHour[] = []): WorkingHour[][] {
  return Array.from({ length: 7 }, (_, day) =>
    schedules.filter((block) => block.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime)),
  );
}

/** Selected services grouped under their category name. */
function servicesByCategory(services: readonly Service[], otherLabel: string): [string, Service[]][] {
  const groups = new Map<string, Service[]>();
  for (const service of services) {
    const category = service.category?.name?.trim() || otherLabel;
    const bucket = groups.get(category);
    if (bucket) {
      bucket.push(service);
    } else {
      groups.set(category, [service]);
    }
  }
  return [...groups.entries()];
}

/**
 * PUBLIC center detail (`/centers/:centerId`).
 *
 * Works for ANY visitor: the center, its gallery, schedule, social links and its
 * reviews all come from endpoints that need no token.
 *
 * AUTH HONESTY: `GET /services` and `GET /personnel` DO require a JWT in
 * `yotuvia-api`, so those two sections are only fetched for a signed-in visitor
 * and a signed-out one gets an explicit "sign in to see this" state instead of
 * an empty list. Fetched reviews are the raw rows of
 * `GET /reviews/beauty-center/:id`; the average and the count are the server's
 * own aggregate on the center payload, never recomputed here.
 *
 * The "Book" call to action always points at the CLIENT-only booking route: a
 * guest lands on `/login` with the booking URL stashed as `state.from` (the
 * `RequireAuth` boundary around that route), so they come back to it right after
 * signing in.
 */
export function CenterDetailPage() {
  const { t, i18n } = useTranslation();
  const { centerId: rawCenterId } = useParams<{ centerId: string }>();
  const centerId = Number(rawCenterId ?? 0);
  const language = i18n.resolvedLanguage ?? i18n.language;

  const { user, role, isAuthenticated } = useAuthSession();
  const isClient = role !== null && CLIENT_APP_ROLES.includes(role);
  const clientId = isClient ? Number(user?.id ?? 0) : 0;

  const centerQuery = useBeautyCenter(centerId, language);
  const reviewsQuery = useReviews(centerId);
  const canReviewQuery = useCanReview(centerId, isClient);
  const canReview = canReviewQuery.data === true;
  const servicesQuery = useClientServices(centerId, { enabled: isAuthenticated });
  const personnelQuery = useCenterPersonnel(centerId, { enabled: isAuthenticated });
  const favoritesQuery = useClientFavorites(clientId);

  const addFavorite = useAddClientFavorite();
  const removeFavorite = useRemoveClientFavorite();
  const { toast } = useToast();

  const center = centerQuery.data;
  const centerName = center?.name.trim() ? center.name : t("web.home.search.unknown_center");

  useDocumentTitle(t("web.centers.detail.meta_title", { name: centerName }));

  const notFound = getErrorStatus(centerQuery.error) === 404;
  const centerError = useErrorMessage(centerQuery.error, "web.centers.detail.error_body");
  const servicesError = useErrorMessage(servicesQuery.error, "web.errors.client_center_services_fetch");
  const personnelError = useErrorMessage(personnelQuery.error, "web.errors.client_center_team_fetch");
  const reviewsError = useErrorMessage(reviewsQuery.error, "web.errors.reviews_fetch");
  const favoriteError = addFavorite.errorKey ?? removeFavorite.errorKey;

  const favoriteRow = useMemo(
    () => (favoritesQuery.data ?? []).find((row) => row.beautyCenterId === centerId) ?? null,
    [favoritesQuery.data, centerId],
  );
  const isFavorite = favoriteRow !== null;

  const services = useMemo(() => servicesQuery.data ?? [], [servicesQuery.data]);
  const groupedServices = useMemo(
    () => servicesByCategory(services, t("client.reservation.category_other")),
    [services, t],
  );
  const images = orderedImages(center?.images);
  const scheduleDays = schedulesByDay(center?.schedules);
  const links = socialLinks(center?.socialMedia);
  const reviews = reviewsQuery.data ?? [];
  const hasRating = typeof center?.averageRating === "number" && center.averageRating > 0;

  const favoritePending = addFavorite.isPending || removeFavorite.isPending;

  const toggleFavorite = async () => {
    if (!isClient || clientId <= 0) return;
    try {
      if (favoriteRow) {
        await removeFavorite.mutateAsync({ clientId, favoriteId: favoriteRow.id });
        toast(t("client.favorites.remove_success"), { variant: "success" });
      } else {
        await addFavorite.mutateAsync({ clientId, beautyCenterId: centerId });
        toast(t("web.centers.detail.favorite_add_success"), { variant: "success" });
      }
    } catch {
      // Surfaced in place through `favoriteError`.
    }
  };

  if (centerId <= 0 || notFound) {
    return (
      <PublicLayout>
        <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
          <Card>
            <CardContent className="flex flex-col items-start gap-3 p-6">
              <h1 className="text-2xl font-bold text-text">{t("web.centers.detail.not_found_title")}</h1>
              <p className="text-sm text-text-muted">{t("web.centers.detail.not_found_body")}</p>
              <Link
                to={ROUTES.centers.search}
                className="rounded text-sm font-semibold text-link underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {t("web.centers.detail.back_to_search")}
              </Link>
            </CardContent>
          </Card>
        </div>
      </PublicLayout>
    );
  }

  if (centerQuery.isPending) {
    return (
      <PublicLayout>
        <div
          role="status"
          aria-live="polite"
          aria-label={t("common.loading")}
          className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10 sm:px-6"
        >
          <Skeleton className="h-8 w-2/3 max-w-md" />
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </PublicLayout>
    );
  }

  if (centerQuery.isError || !center) {
    return (
      <PublicLayout>
        <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
          <Card role="alert">
            <CardContent className="flex flex-col items-start gap-3 p-6">
              <h1 className="text-2xl font-bold text-text">{t("web.centers.detail.error_title")}</h1>
              <p className="text-sm text-text-muted">{centerError}</p>
              <Button variant="outline" onClick={() => void centerQuery.refetch()}>
                {t("common.retry")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <article className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <Link
          to={ROUTES.centers.search}
          className="inline-flex items-center rounded text-sm font-semibold text-link underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {t("web.centers.detail.back_to_search")}
        </Link>

        <header className="mt-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">{centerName}</h1>
            {hasRating ? (
              <p className="flex items-center gap-2 text-sm text-text-muted">
                <span aria-hidden="true">★</span>
                {t("web.home.search.rating_reviews", {
                  rating: formatRating(center.averageRating ?? 0, language),
                  count: formatNumber(center.reviewCount ?? 0, language),
                })}
              </p>
            ) : (
              <Badge>{t("web.home.search.no_rating")}</Badge>
            )}
          </div>

          {center.address.trim() ? (
            <p className="text-sm text-text-muted">{center.address}</p>
          ) : null}

          <LoyaltyProgramBadge centerId={center.id} />

          <div className="flex flex-wrap items-center gap-3">
            <Link to={centerBookingPath(center.id)} className={buttonClasses({ size: "lg" })}>
              {t("client.center.book")}
            </Link>

            {isClient && clientId > 0 ? (
              <Button
                variant="outline"
                size="lg"
                loading={favoritePending}
                aria-pressed={isFavorite}
                onClick={() => void toggleFavorite()}
              >
                {isFavorite
                  ? t("web.centers.detail.favorite_saved")
                  : t("web.centers.detail.favorite_add")}
              </Button>
            ) : null}
          </div>

          {!isAuthenticated ? (
            <p className="text-sm text-text-secondary">{t("web.centers.detail.book_hint_guest")}</p>
          ) : null}

          {favoriteError ? (
            <p role="alert" className="text-sm text-danger">
              {t(favoriteError, { defaultValue: favoriteError })}
            </p>
          ) : null}
        </header>

        {links.length > 0 ? (
          <section className="mt-8" aria-labelledby="center-social">
            <h2 id="center-social" className="text-lg font-semibold text-text">
              {t("web.centers.detail.social_title")}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-3">
              {links.map((link) => {
                const network = t(SOCIAL_KEYS[link.network]);
                return (
                  <li key={link.network}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={t("web.centers.detail.social_link_aria", { network })}
                      className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-link transition-colors hover:border-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {network}
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <section className="mt-8" aria-labelledby="center-about">
          <h2 id="center-about" className="text-lg font-semibold text-text">
            {t("web.centers.detail.about")}
          </h2>
          {center.description.trim() ? (
            <p className="mt-2 whitespace-pre-line text-sm text-text-muted">{center.description}</p>
          ) : (
            <p className="mt-2 text-sm text-text-muted">{t("web.centers.detail.no_description")}</p>
          )}
        </section>

        <section className="mt-8" aria-labelledby="center-gallery">
          <h2 id="center-gallery" className="text-lg font-semibold text-text">
            {t("web.centers.detail.gallery")}
          </h2>
          {images.length > 0 ? (
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map((image) => (
                <li key={image.id}>
                  <img
                    src={image.imageUrl}
                    alt=""
                    loading="lazy"
                    className="h-32 w-full rounded-lg border border-border object-cover sm:h-40"
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={t("web.centers.detail.gallery_empty")} className="mt-2" />
          )}
        </section>

        <section className="mt-8" aria-labelledby="center-schedule">
          <h2 id="center-schedule" className="text-lg font-semibold text-text">
            {t("client.center.schedules_section")}
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {scheduleDays.map((blocks, day) => (
              <li
                key={day}
                className="flex items-baseline justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <span className="font-medium text-text">{t(`client.center.days.${day}`)}</span>
                <span className="text-text-muted" dir="ltr">
                  {blocks.length === 0
                    ? t("web.centers.detail.closed_day")
                    : blocks.map((block) => `${formatTime(block.startTime)}–${formatTime(block.endTime)}`).join(", ")}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8" aria-labelledby="center-services">
          <h2 id="center-services" className="text-lg font-semibold text-text">
            {t("web.centers.detail.services")}
          </h2>

          {!isAuthenticated ? (
            <Card className="mt-3">
              <CardContent className="flex flex-col gap-1 p-4">
                <p className="text-sm font-semibold text-text">
                  {t("web.centers.detail.services_auth_title")}
                </p>
                <p className="text-sm text-text-muted">
                  {t("web.centers.detail.services_auth_body")}
                </p>
              </CardContent>
            </Card>
          ) : servicesQuery.isPending ? (
            <div
              role="status"
              aria-live="polite"
              aria-label={t("common.loading")}
              className="mt-3 flex flex-col gap-2"
            >
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : servicesQuery.isError ? (
            <Card role="alert" className="mt-3">
              <CardContent className="flex flex-col gap-3 p-4">
                <p className="text-sm text-text-muted">{servicesError}</p>
                <Button
                  variant="outline"
                  className="self-start"
                  onClick={() => void servicesQuery.refetch()}
                >
                  {t("common.retry")}
                </Button>
              </CardContent>
            </Card>
          ) : services.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">{t("client.center.no_services")}</p>
          ) : (
            <div className="mt-3 flex flex-col gap-4">
              {groupedServices.map(([category, items]) => (
                <div key={category}>
                  <h3 className="text-sm font-semibold text-text-muted">{category}</h3>
                  <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                    {items.map((service) => (
                      <li
                        key={service.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
                      >
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium text-text">{service.name}</span>
                          <span className="text-xs text-text-muted">
                            {formatNumber(service.duration, language)}
                            {t("client.center.min_unit")}
                          </span>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-text">
                          {formatCurrency(service.price, language, center.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8" aria-labelledby="center-team">
          <h2 id="center-team" className="text-lg font-semibold text-text">
            {t("web.centers.detail.personnel")}
          </h2>

          {!isAuthenticated ? (
            <Card className="mt-3">
              <CardContent className="flex flex-col gap-1 p-4">
                <p className="text-sm font-semibold text-text">
                  {t("web.centers.detail.personnel_auth_title")}
                </p>
                <p className="text-sm text-text-muted">
                  {t("web.centers.detail.personnel_auth_body")}
                </p>
              </CardContent>
            </Card>
          ) : personnelQuery.isPending ? (
            <div
              role="status"
              aria-live="polite"
              aria-label={t("common.loading")}
              className="mt-3"
            >
              <Skeleton className="h-12 w-full" />
            </div>
          ) : personnelQuery.isError ? (
            <Card role="alert" className="mt-3">
              <CardContent className="flex flex-col gap-3 p-4">
                <p className="text-sm text-text-muted">{personnelError}</p>
                <Button
                  variant="outline"
                  className="self-start"
                  onClick={() => void personnelQuery.refetch()}
                >
                  {t("common.retry")}
                </Button>
              </CardContent>
            </Card>
          ) : (personnelQuery.data ?? []).length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">{t("web.centers.detail.personnel_empty")}</p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {(personnelQuery.data ?? []).map((member) => (
                <li
                  key={member.id}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-text"
                >
                  {`${member.firstName} ${member.lastName}`.trim()}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8" aria-labelledby="center-reviews">
          <h2 id="center-reviews" className="text-lg font-semibold text-text">
            {t("client.center.tab_reviews")}
          </h2>

          {reviewsQuery.isPending ? (
            <div
              role="status"
              aria-live="polite"
              aria-label={t("common.loading")}
              className="mt-3 flex flex-col gap-2"
            >
              <Skeleton className="h-20 w-full" />
            </div>
          ) : reviewsQuery.isError ? (
            <Card role="alert" className="mt-3">
              <CardContent className="flex flex-col gap-3 p-4">
                <p className="text-sm text-text-muted">{reviewsError}</p>
                <Button
                  variant="outline"
                  className="self-start"
                  onClick={() => void reviewsQuery.refetch()}
                >
                  {t("common.retry")}
                </Button>
              </CardContent>
            </Card>
          ) : reviews.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">{t("client.center.reviews_empty")}</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {reviews.map((review) => (
                <li key={review.id}>
                  <ReviewCard review={review} language={language} />
                </li>
              ))}
            </ul>
          )}

          {canReview ? <ReviewForm centerId={centerId} /> : null}
        </section>

        {center.url?.trim() ? (
          <p className="mt-8 text-sm text-text-muted">
            <a
              href={center.url}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded font-medium text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t("web.centers.detail.website")}
            </a>
          </p>
        ) : null}
      </article>
    </PublicLayout>
  );
}
