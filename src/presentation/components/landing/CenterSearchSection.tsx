import { lazy, Suspense, useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { BeautyCenter, RankingItem, RankingPeriod } from "yotuvia-core";

import {
  CenterResultsList,
  CenterResultsSkeleton,
  RankingPeriodControl,
  SelectedCenterSheet,
} from "@/presentation/components/centers";
import type { SelectedCenterBooking } from "@/presentation/components/centers";
import { Button, Input, Select } from "@/presentation/components/ui";
import { useAuthSession } from "@/presentation/hooks/use-auth-session";
import {
  MIN_SEARCH_LENGTH,
  useSearchBeautyCenters,
  useTopRatedCenters,
} from "@/presentation/hooks/use-beauty-centers";
import { useDebouncedValue } from "@/presentation/hooks/use-debounced-value";
import { useMountWhenVisible } from "@/presentation/hooks/use-mount-when-visible";
import { useCenterRanking } from "@/presentation/hooks/use-ranking";
import { useCategoryTemplates } from "@/presentation/hooks/use-services";
import { useErrorMessage } from "@/presentation/lib/errors";
import { CLIENT_APP_ROLES } from "@/presentation/lib/roles";
import { ROUTES, centerBookingPath } from "@/presentation/lib/routes";

import { IconSearch } from "./icons";

/** Delay before a keystroke/selection is turned into a request. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * How many top-rated centers seed the map/list before the visitor searches.
 *
 * `GET /beauty-centers/top-rated` is public, so a guest gets markers on arrival
 * without a token. Mirrors the featured section of the full search page.
 */
const FEATURED_LIMIT = 10;

/** Ranking period the landing map opens on (mirrors the full search page). */
const DEFAULT_RANKING_PERIOD: RankingPeriod = "week";

/** Stable empty arrays so effect deps never churn. */
const EMPTY_CENTERS: BeautyCenter[] = [];
const EMPTY_RANKING: RankingItem[] = [];

/**
 * The map is the PRIMARY element of this section, exactly like the client-area
 * search page, and it is code-split with `React.lazy` so `maplibre-gl` (large)
 * and the map component's own CSS/CSS never join the app entry chunk. It is the
 * SAME component the client area uses — not a second map.
 */
const LazyCenterMap = lazy(() =>
  import("@/presentation/components/centers/CenterMap").then((module) => ({
    default: module.CenterMap,
  })),
);

/** Fallback shown while the lazily-loaded map chunk is fetched. */
function MapFallback() {
  const { t } = useTranslation();
  return (
    <div className="flex h-[60vh] min-h-[360px] w-full items-center justify-center rounded-lg border border-dashed border-border">
      <p className="text-sm text-text-muted">{t("web.centers.map.loading")}</p>
    </div>
  );
}

/**
 * Landing "find a beauty center" section.
 *
 * Shows the SAME map experience as the client area: the shared `CenterMap`
 * plotted with the public featured/top-rated set and the ranking badges for the
 * active period, with the results as a full-width horizontal carousel directly
 * below it (so the list stays a complete, accessible path to every center — the
 * map is never the only way in).
 *
 * GUEST-SAFE: every request made here is public (`GET /beauty-centers/search`,
 * `/top-rated` and `/ranking`). `GET /category/templates` and the per-center
 * services need a JWT, so they are gated behind `enabled: isAuthenticated` and a
 * guest simply never issues them — a JWT-gated call on the public landing used
 * to answer 401 and sign the anonymous visitor out to `/login`. The SAME rule
 * applies to the map: it is passed no favourite/services props, so it makes no
 * authenticated request either.
 *
 * HEAVY MAP: the map chunk is fetched lazily AND its mount is deferred until the
 * section scrolls into view (`useMountWhenVisible`), so a visitor who never
 * reaches the centers block pays neither for MapLibre nor for a WebGL context on
 * first paint. When `IntersectionObserver` is unavailable the map mounts
 * immediately, so the section still works everywhere.
 *
 * BOOKING GATE: a guest can look and browse but cannot book. Selecting a center
 * opens the shared sheet, whose "Book" CTA becomes a "sign in / create account"
 * gate that preserves the intended booking destination; only a signed-in CLIENT
 * gets the direct booking link.
 */
export function CenterSearchSection() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;

  const { role, isAuthenticated } = useAuthSession();
  const isClient = role !== null && CLIENT_APP_ROLES.includes(role);

  const [term, setTerm] = useState("");
  const [category, setCategory] = useState("");
  const [rankingPeriod, setRankingPeriod] = useState<RankingPeriod>(DEFAULT_RANKING_PERIOD);
  const [selectedCenter, setSelectedCenter] = useState<BeautyCenter | null>(null);

  const mapWrapperRef = useRef<HTMLDivElement>(null);
  const mapVisible = useMountWhenVisible(mapWrapperRef);

  const debouncedTerm = useDebouncedValue(term, SEARCH_DEBOUNCE_MS);
  const debouncedCategory = useDebouncedValue(category, SEARCH_DEBOUNCE_MS);

  // There is no server-side category filter on the public search endpoint, so
  // the selected category is folded into the same query string.
  const query = [debouncedTerm.trim(), debouncedCategory.trim()].filter(Boolean).join(" ");
  const isQueryReady = query.length >= MIN_SEARCH_LENGTH;

  const search = useSearchBeautyCenters(query);
  const featured = useTopRatedCenters(FEATURED_LIMIT);
  const ranking = useCenterRanking(rankingPeriod);
  // `GET /category/templates` requires a JWT, so the picker is only offered to a
  // signed-in visitor; a guest would otherwise trigger the 401 sign-out.
  const categories = useCategoryTemplates(language, { enabled: isAuthenticated });
  const errorMessage = useErrorMessage(search.error, "web.home.search.error_body");

  const searchResults = search.data?.data ?? EMPTY_CENTERS;
  const featuredResults = featured.data ?? EMPTY_CENTERS;
  const rankingItems = ranking.data ?? EMPTY_RANKING;

  const searchLoading = isQueryReady && search.isPending;
  const showEmpty = isQueryReady && search.isSuccess && searchResults.length === 0;

  // What the MAP draws: the term result once the search settles, otherwise the
  // featured set. While a search is in flight the featured set stays on the map
  // so it is never blank for the duration of a round-trip.
  const plottedCenters = useMemo(() => {
    if (!isQueryReady) return featuredResults;
    return searchLoading && searchResults.length === 0 ? featuredResults : searchResults;
  }, [featuredResults, isQueryReady, searchLoading, searchResults]);

  // What the LIST shows (it follows the settled search, else the featured set).
  const listResults = isQueryReady ? searchResults : featuredResults;
  const listLoading = isQueryReady ? search.isPending : featured.isPending;
  const listCount = isQueryReady ? (search.data?.total ?? searchResults.length) : featuredResults.length;
  const listFailed = isQueryReady ? search.isError : featured.isError;
  const listReady = isQueryReady ? search.isSuccess : featured.isSuccess;
  const hasListResults = listReady && listResults.length > 0;

  // BOOKING GATE: guest -> auth gate preserving the destination; client -> direct
  // booking link; any other signed-in role -> no booking CTA at all.
  const booking = useMemo<SelectedCenterBooking | undefined>(() => {
    if (selectedCenter === null) return undefined;
    if (isClient) return { href: centerBookingPath(selectedCenter.id), requiresAuth: false };
    if (isAuthenticated) return undefined;
    return { href: centerBookingPath(selectedCenter.id), requiresAuth: true };
  }, [isAuthenticated, isClient, selectedCenter]);

  const handleSelectCenter = useCallback((center: BeautyCenter) => {
    setSelectedCenter(center);
  }, []);

  const handleTermChange = useCallback((value: string) => {
    setTerm(value);
  }, []);

  return (
    <section id="centers" aria-labelledby="centers-title" className="border-b border-border bg-card">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <h2 id="centers-title" className="text-2xl font-bold tracking-tight text-text sm:text-3xl">
          {t("web.home.search.title")}
        </h2>
        <p className="mt-2 max-w-2xl text-text-muted">{t("web.home.search.subtitle")}</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Input
            type="search"
            label={t("web.home.search.label")}
            placeholder={t("web.home.search.placeholder")}
            value={term}
            onChange={(event) => handleTermChange(event.target.value)}
            helperText={t("web.home.search.hint", { min: MIN_SEARCH_LENGTH })}
            autoComplete="off"
          />
          {isAuthenticated ? (
            <Select
              label={t("web.home.search.category_label")}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="">{t("web.home.search.category_all")}</option>
              {(categories.data ?? []).map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name}
                </option>
              ))}
            </Select>
          ) : null}
        </div>

        <div className="mt-8 flex flex-col gap-6">
          {/*
            MAP: primary and always visible (lazily mounted when scrolled into
            view). Not the only path to a center — the list beside it links to
            every plotted center's detail page.
          */}
          <div className="min-w-0">
            <div className="mb-3 flex flex-col gap-2">
              <RankingPeriodControl period={rankingPeriod} onChange={setRankingPeriod} />
              <p className="max-w-xl text-xs text-text-muted">
                {t("web.centers.map.ranking_note")}
              </p>
            </div>

            <div ref={mapWrapperRef}>
              {mapVisible ? (
                <Suspense fallback={<MapFallback />}>
                  <LazyCenterMap
                    centers={plottedCenters}
                    language={language}
                    selectedCenterId={selectedCenter?.id ?? null}
                    ranking={rankingItems}
                    onSelectCenter={handleSelectCenter}
                  />
                </Suspense>
              ) : (
                <MapFallback />
              )}
            </div>

            {!isQueryReady && featured.isPending ? (
              <p className="mt-3 text-sm text-text-muted">
                {t("web.centers.search.featured_loading")}
              </p>
            ) : null}
          </div>

          {/* RESULTS: a full-width carousel below the map, same at every breakpoint. */}
          <aside
            aria-label={t("web.centers.results.panel_label")}
            className="flex min-w-0 flex-col gap-4"
          >
            <p className="text-sm font-semibold text-text">{t("web.centers.results.title")}</p>

            <div aria-live="polite" aria-busy={listLoading || undefined}>
              {listLoading ? (
                <>
                  <p className="sr-only">{t("web.home.search.loading")}</p>
                  <CenterResultsSkeleton count={3} gridClassName="grid gap-4 sm:grid-cols-2" />
                </>
              ) : null}

              {listFailed ? (
                <div
                  role="alert"
                  className="flex flex-col items-center gap-3 rounded-lg border border-danger/40 px-4 py-10 text-center"
                >
                  <p className="font-semibold text-text">{t("web.home.search.error_title")}</p>
                  <p className="max-w-md text-sm text-text-muted">
                    {isQueryReady ? (errorMessage ?? t("web.home.search.error_body")) : t("web.home.search.error_body")}
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => void (isQueryReady ? search.refetch() : featured.refetch())}
                  >
                    {t("web.home.search.retry")}
                  </Button>
                </div>
              ) : null}

              {showEmpty ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-12 text-center">
                  <p className="font-semibold text-text">{t("web.home.search.empty_title")}</p>
                  <p className="max-w-md text-sm text-text-muted">{t("web.home.search.empty_body")}</p>
                </div>
              ) : null}

              {!isQueryReady && !listLoading && !listFailed && !hasListResults ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-12 text-center">
                  <IconSearch className="h-6 w-6 text-text-muted" />
                  <p className="font-semibold text-text">{t("web.home.search.idle_title")}</p>
                  <p className="max-w-md text-sm text-text-muted">{t("web.home.search.idle_body")}</p>
                  <Link
                    to={ROUTES.centers.search}
                    className="mt-2 rounded text-sm font-semibold text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {t("web.home.search.open_search")}
                  </Link>
                </div>
              ) : null}

              {hasListResults ? (
                <>
                  <p className="mb-4 text-sm font-medium text-text-muted">
                    {isQueryReady
                      ? t("web.home.search.results_count", { count: listCount })
                      : t("web.centers.search.featured_count", { count: listCount })}
                  </p>
                  <CenterResultsList
                    results={listResults}
                    language={language}
                    selectedCenterId={selectedCenter?.id ?? null}
                    onQuickView={handleSelectCenter}
                  />
                </>
              ) : null}
            </div>

            <Link
              to={ROUTES.centers.search}
              className="rounded text-sm font-semibold text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t("web.home.search.open_search")}
            </Link>
          </aside>
        </div>
      </div>

      <SelectedCenterSheet
        center={selectedCenter}
        language={language}
        canFavorite={false}
        isFavorite={false}
        favoritePending={false}
        favoriteError={null}
        onToggleFavorite={() => undefined}
        booking={booking}
        onClose={() => setSelectedCenter(null)}
      />
    </section>
  );
}
