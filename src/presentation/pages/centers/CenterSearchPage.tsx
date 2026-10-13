import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import type { BeautyCenter, RankingItem, RankingPeriod } from "yotuvia-core";

import {
  CenterFiltersPanel,
  CenterResultsList,
  CenterResultsSkeleton,
  RankingPeriodControl,
  SelectedCenterSheet,
  ServiceCategoryDialog,
  ServiceChips,
} from "@/presentation/components/centers";
import { Button, Input } from "@/presentation/components/ui";
import {
  MIN_SEARCH_LENGTH,
  useNearbyCenters,
  useSearchBeautyCenters,
  useTopRatedCenters,
} from "@/presentation/hooks/use-beauty-centers";
import { useAuthSession } from "@/presentation/hooks/use-auth-session";
import { useCenterFavorites } from "@/presentation/hooks/use-center-favorites";
import { useCenterRanking } from "@/presentation/hooks/use-ranking";
import { useServiceChips } from "@/presentation/hooks/use-service-chips";
import { useDebouncedValue } from "@/presentation/hooks/use-debounced-value";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { useGeolocation } from "@/presentation/hooks/use-geolocation";
import type { GeolocationErrorKind } from "@/presentation/hooks/use-geolocation";
import {
  activeFilterCount,
  applyCenterFilters,
  applyServiceFilter,
  hasRatingData,
  hasScheduleData,
} from "@/presentation/lib/center-filters";
import { useErrorMessage } from "@/presentation/lib/errors";
import { CLIENT_APP_ROLES } from "@/presentation/lib/roles";
import { PublicLayout } from "@/presentation/layouts/PublicLayout";

/**
 * The map is the PRIMARY element of this page: it renders by default, in the
 * main column. It stays code-split with `React.lazy` so `maplibre-gl` (large)
 * and the map component's own code/CSS live in their own chunk instead of the
 * app entry chunk — the library is still fetched on demand, but for the main
 * content rather than behind a toggle.
 */
const LazyCenterMap = lazy(() =>
  import("@/presentation/components/centers/CenterMap").then((module) => ({
    default: module.CenterMap,
  })),
);

/** Delay before a keystroke is turned into a request. */
const SEARCH_DEBOUNCE_MS = 300;
/** How many centers "near me" asks the API for. */
const NEARBY_LIMIT = 20;
/**
 * How many top-rated centers seed the page before the visitor searches.
 *
 * The map is the primary element here, and a map with nothing on it reads as
 * broken, so a public "featured" set is fetched on arrival (`GET
 * /beauty-centers/top-rated` is public, like `/search` and `/nearby`) and shown
 * on the map AND in the list until a term search or "near me" replaces it.
 */
const FEATURED_LIMIT = 10;

/** Stable empty array so React Query's `undefined` never churns effect deps. */
const EMPTY_CENTERS: BeautyCenter[] = [];

/** Stable empty ranking so the marker effect deps never churn either. */
const EMPTY_RANKING: RankingItem[] = [];

/** Ranking period the map opens on (mirrors the task's `all` default). */
/**
 * Default period matches the mobile app (`use-home-map-vm.ts` initialises
 * `rankingPeriod` to `"week"`), so both clients open on the same ranking.
 */
const DEFAULT_RANKING_PERIOD: RankingPeriod = "week";

/** Loading placeholder grid for the results panel (shown while a set loads). */
const PANEL_GRID = "grid gap-4 sm:grid-cols-2";

const GEOLOCATION_TITLE_KEYS: Readonly<Record<GeolocationErrorKind, string>> = {
  denied: "web.centers.geolocation.denied_title",
  unavailable: "web.centers.geolocation.unavailable_title",
  timeout: "web.centers.geolocation.timeout_title",
  unsupported: "web.centers.geolocation.unsupported_title",
};

const GEOLOCATION_BODY_KEYS: Readonly<Record<GeolocationErrorKind, string>> = {
  denied: "web.centers.geolocation.denied_body",
  unavailable: "web.centers.geolocation.unavailable_body",
  timeout: "web.centers.geolocation.timeout_body",
  unsupported: "web.centers.geolocation.unsupported_body",
};

/** Fallback the Suspense boundary shows while the map chunk is fetched. */
function MapFallback() {
  const { t } = useTranslation();
  return (
    <div className="flex h-[60vh] min-h-[360px] w-full items-center justify-center rounded-lg border border-dashed border-border">
      <p className="text-sm text-text-muted">{t("web.centers.map.loading")}</p>
    </div>
  );
}

interface GeolocationErrorPanelProps {
  error: GeolocationErrorKind | null;
  onRetry: () => void;
  onSearchInstead: () => void;
}

/**
 * Recovery surface for every geolocation failure. It always offers a retry AND
 * a way back to the ordinary term search, so a denied permission can never
 * strand the visitor. The results list and the map stay visible around it.
 */
function GeolocationErrorPanel({ error, onRetry, onSearchInstead }: GeolocationErrorPanelProps) {
  const { t } = useTranslation();
  const kind: GeolocationErrorKind = error ?? "unavailable";
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-danger/40 px-4 py-10 text-center"
    >
      <p className="font-semibold text-text">{t(GEOLOCATION_TITLE_KEYS[kind])}</p>
      <p className="max-w-md text-sm text-text-muted">{t(GEOLOCATION_BODY_KEYS[kind])}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="outline" onClick={onRetry}>
          {t("web.centers.geolocation.retry")}
        </Button>
        <Button variant="ghost" onClick={onSearchInstead}>
          {t("web.centers.geolocation.search_instead")}
        </Button>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  body: string;
}

function EmptyState({ title, body }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-12 text-center">
      <p className="font-semibold text-text">{title}</p>
      <p className="max-w-md text-sm text-text-muted">{body}</p>
    </div>
  );
}

/**
 * PUBLIC center search (`/centers`).
 *
 * Works for a signed-out visitor: it calls `searchBeautyCentersUseCase`, served
 * by `GET /beauty-centers/search` which needs no token, and `getNearbyCenters`
 * (`GET /beauty-centers/nearby`) — also public, so asking for nearby centers
 * never triggers a 401 that would bounce a guest to `/login`.
 *
 * LAYOUT: the map is the PRIMARY element and the default view of the page, and
 * it spans the full content width. The results render as a HORIZONTAL carousel
 * directly BELOW the map — the same component at every breakpoint — instead of a
 * sticky side panel, so the cards keep their horizontal shape and the map is
 * never squeezed into a narrow column. The list is always rendered, so it stays
 * a complete, accessible path to every center; the map is never the only way
 * to reach one.
 *
 * ARRIVAL: before any search the page is seeded with the top-rated "featured"
 * centers (also public), so the map opens with real markers instead of an empty
 * world view and the list has something to show. A term search or "near me"
 * replaces that set; clearing the term brings it back.
 *
 * FILTERS: the public endpoints accept only a free-text term, so the minimum
 * rating and "open now" filters are applied CLIENT-SIDE to the loaded set, and
 * both the map and the list run through the same pure filter helpers so they
 * never disagree. A filter whose data is entirely absent for the current set is
 * disabled (with a reason) and skipped instead of silently emptying the page.
 *
 * AUTH-AWARE SURFACES:
 * - FAVOURITES (heart + selected-center toggle) are CLIENT-only. The endpoints
 *   are role-gated to `client`, so the control is not rendered at all for a
 *   guest or a non-client role.
 * - SERVICE CHIPS need a JWT (`GET /services`), so the per-center queries are
 *   `enabled` only for an authenticated visitor and a guest sees no chips,
 *   rather than a request that would sign them out.
 *
 * Geolocation is requested ONLY when the visitor presses "Near me" (see
 * `handleNearMe`), never on load, and its four failure modes each get a
 * translated, recoverable state.
 *
 * The optional `?term=` query param seeds the input, which is how the landing
 * links a started search into this page.
 */
export function CenterSearchPage() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t("web.centers.search.meta_title"));

  const [searchParams] = useSearchParams();
  const [term, setTerm] = useState(() => searchParams.get("term") ?? "");
  const [nearbyRequested, setNearbyRequested] = useState(false);
  const [selectedCenterId, setSelectedCenterId] = useState<number | null>(null);
  const [rankingPeriod, setRankingPeriod] =
    useState<RankingPeriod>(DEFAULT_RANKING_PERIOD);

  // ── Client-side filters (map + list) ──
  const [minRating, setMinRating] = useState(0);
  const [openNow, setOpenNow] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // ── Selected-center sheet + full category list ──
  const [selectedCenter, setSelectedCenter] = useState<BeautyCenter | null>(null);
  const [showAllCategories, setShowAllCategories] = useState(false);

  const language = i18n.resolvedLanguage ?? i18n.language;
  const debouncedTerm = useDebouncedValue(term, SEARCH_DEBOUNCE_MS);
  const query = debouncedTerm.trim();
  const isQueryReady = query.length >= MIN_SEARCH_LENGTH;

  // ── Session ──
  const { user, role, isAuthenticated } = useAuthSession();
  const isClient = role !== null && CLIENT_APP_ROLES.includes(role);
  const clientId = isClient ? Number(user?.id ?? 0) : 0;

  const search = useSearchBeautyCenters(query);
  const errorMessage = useErrorMessage(search.error, "web.centers.search.error_body");

  // Default set: fetched on arrival so the map is never blank, replaced by a
  // term search or "near me" (see `plottedCenters`).
  const featured = useTopRatedCenters(FEATURED_LIMIT);

  /**
   * Ranking for the active period.
   *
   * COEXISTENCE WITH THE PLOTTED SETS: the ranking does NOT add or remove
   * markers. The map keeps its "near me → term search → featured" precedence
   * (below) and every center without coordinates in the API payload simply has
   * no marker. The ranking only ANNOTATES the centers that are already plotted:
   * an id that appears in `ranking` gets a crown/star badge, and an id that does
   * not keeps the neutral dot — so a rank badge can never appear on a center
   * that is not part of the selected result. The map therefore stays populated
   * on arrival and the badges stay truthful.
   */
  const ranking = useCenterRanking(rankingPeriod);
  const rankingItems = ranking.data ?? EMPTY_RANKING;

  const { coordinates, status: geoStatus, error: geoError, request: requestLocation } =
    useGeolocation();
  const nearby = useNearbyCenters(
    coordinates?.latitude ?? null,
    coordinates?.longitude ?? null,
    NEARBY_LIMIT,
  );

  const userLocation = useMemo(
    () =>
      coordinates
        ? { latitude: coordinates.latitude, longitude: coordinates.longitude }
        : null,
    [coordinates],
  );

  // Editing the term always leaves "near me" mode and goes back to the term
  // search, so a denied permission never blocks the normal search path. The
  // reset happens in the input handler (not an effect) to avoid a cascading
  // render: typing is itself the signal that the visitor wants a term search.
  const handleTermChange = useCallback((value: string) => {
    setTerm(value);
    setNearbyRequested(false);
  }, []);

  const searchResults = search.data?.data ?? EMPTY_CENTERS;
  const nearbyResults = nearby.data ?? EMPTY_CENTERS;
  const featuredResults = featured.data ?? EMPTY_CENTERS;

  const handleNearMe = useCallback(() => {
    setNearbyRequested(true);
    requestLocation();
  }, [requestLocation]);

  // Both the map marker and the list card converge here, so selecting either
  // mirrors the choice into the other AND opens the detail sheet.
  const handleSelectCenter = useCallback((center: BeautyCenter) => {
    setSelectedCenterId(center.id);
    setSelectedCenter(center);
  }, []);

  // ── "Near me" derived state ──
  const nearbyLoading =
    nearbyRequested && (geoStatus === "locating" || (geoStatus === "success" && nearby.isPending));
  const nearbyFailed = nearbyRequested && geoStatus === "error";
  const nearbyEmpty =
    nearbyRequested &&
    geoStatus === "success" &&
    nearby.isSuccess &&
    nearbyResults.length === 0;
  const nearbyReady =
    nearbyRequested &&
    geoStatus === "success" &&
    nearby.isSuccess &&
    nearbyResults.length > 0;

  // ── Term-search derived state (unchanged public behavior) ──
  const searchLoading = !nearbyRequested && isQueryReady && search.isPending;
  const searchFailed = !nearbyRequested && isQueryReady && search.isError;
  const searchEmpty =
    !nearbyRequested && isQueryReady && search.isSuccess && searchResults.length === 0;
  const searchReady =
    !nearbyRequested && isQueryReady && search.isSuccess && searchResults.length > 0;

  // ── Featured (default) set: what the page shows before any search ──
  const isFeaturedView = !nearbyRequested && !isQueryReady;
  const featuredLoading = isFeaturedView && featured.isPending;
  const featuredFailed = isFeaturedView && featured.isError;
  const featuredReady = isFeaturedView && featured.isSuccess && featuredResults.length > 0;
  const featuredEmpty = isFeaturedView && featured.isSuccess && featuredResults.length === 0;

  /**
   * What the MAP draws.
   *
   * Order of precedence: "near me" → term search → featured set. The featured
   * set is the BASE, so the map is never blank on arrival, and an in-flight
   * search/"near me" holds it on screen until the request actually brings rows
   * back — clearing the map for the duration of a round-trip read as a failure.
   * A SETTLED request is followed exactly, including the zero-result and
   * single-center cases, so the map never contradicts the list beside it.
   *
   * The client-side filters are applied AFTER this precedence (below), so the
   * map and the list share one filtered set.
   */
  const plottedCenters = useMemo(() => {
    if (nearbyRequested) {
      return nearbyLoading && nearbyResults.length === 0 ? featuredResults : nearbyResults;
    }
    if (isQueryReady) {
      return searchLoading && searchResults.length === 0 ? featuredResults : searchResults;
    }
    return featuredResults;
  }, [
    featuredResults,
    isQueryReady,
    nearbyLoading,
    nearbyRequested,
    nearbyResults,
    searchLoading,
    searchResults,
  ]);

  // ── Service chips (JWT-gated, so disabled for a guest) ──
  const plottedIds = useMemo(() => plottedCenters.map((center) => center.id), [plottedCenters]);
  const chips = useServiceChips(plottedIds, isAuthenticated);

  const serviceFilteredPlotted = useMemo(
    () => applyServiceFilter(plottedCenters, chips.matchingCenterIds),
    [chips.matchingCenterIds, plottedCenters],
  );

  // ── Filter availability, computed from the current (chip-scoped) set ──
  const ratingAvailable = useMemo(
    () => hasRatingData(serviceFilteredPlotted),
    [serviceFilteredPlotted],
  );
  const openNowAvailable = useMemo(
    () => hasScheduleData(serviceFilteredPlotted),
    [serviceFilteredPlotted],
  );

  const filteredPlotted = useMemo(
    () => applyCenterFilters(serviceFilteredPlotted, { minRating, openNow }),
    [serviceFilteredPlotted, minRating, openNow],
  );

  const isBusy = searchLoading || nearbyLoading || featuredLoading;

  const geolocationAnnouncement =
    geoStatus === "locating"
      ? t("web.centers.geolocation.locating")
      : geoStatus === "success"
        ? t("web.centers.geolocation.success", { count: nearbyResults.length })
        : geoStatus === "error"
          ? t(GEOLOCATION_TITLE_KEYS[geoError ?? "unavailable"])
          : "";

  const listResults = nearbyRequested
    ? nearbyResults
    : isQueryReady
      ? searchResults
      : featuredResults;

  const serviceFilteredList = useMemo(
    () => applyServiceFilter(listResults, chips.matchingCenterIds),
    [chips.matchingCenterIds, listResults],
  );

  const filteredList = useMemo(
    () => applyCenterFilters(serviceFilteredList, { minRating, openNow }),
    [serviceFilteredList, minRating, openNow],
  );

  const listCount = nearbyRequested
    ? nearbyResults.length
    : isQueryReady
      ? (search.data?.total ?? searchResults.length)
      : featuredResults.length;

  const activeFilters = activeFilterCount({ minRating, openNow });
  const hasNarrowing = activeFilters > 0 || chips.selected !== null;
  const baseReady = nearbyRequested ? nearbyReady : isQueryReady ? searchReady : featuredReady;
  const visibleList = filteredList;
  const hasListResults = baseReady && visibleList.length > 0;
  const narrowedEmpty = baseReady && hasNarrowing && visibleList.length === 0;
  // Once a filter narrows the set, the count must describe what is SHOWN, not
  // the server total of the unfiltered result.
  const displayCount = hasNarrowing ? visibleList.length : listCount;
  // Only a genuinely empty featured set leaves the panel with nothing to show;
  // a failed one gets its own retry block below, and otherwise the featured
  // centers ARE the arrival content.
  const listIdle = featuredEmpty;

  // ── Favourites (CLIENT-only) ──
  const favorites = useCenterFavorites(clientId);
  const canFavorite = isClient && clientId > 0;

  const handleToggleFavorite = useCallback(() => {
    if (!selectedCenter || !canFavorite) return;
    // Failures surface through `favorites.errorKey` inside the sheet.
    void favorites.toggleFavorite(selectedCenter.id).catch(() => {});
  }, [canFavorite, favorites, selectedCenter]);

  const showChips = isAuthenticated && (chips.loading || chips.chips.length > 0);

  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">
          {t("web.centers.search.title")}
        </h1>
        <p className="mt-2 max-w-2xl text-text-secondary">{t("web.centers.search.subtitle")}</p>

        <div className="mt-8 max-w-xl">
          <Input
            type="search"
            label={t("web.centers.search.label")}
            placeholder={t("web.centers.search.placeholder")}
            value={term}
            onChange={(event) => handleTermChange(event.target.value)}
            helperText={t("web.centers.search.hint", { min: MIN_SEARCH_LENGTH })}
            autoComplete="off"
          />
        </div>

        {/*
          The API has no server-side rating/availability filter, so those are
          applied client-side to the loaded set; this note states that plainly.
        */}
        <p className="mt-3 max-w-xl text-xs text-text-muted">{t("web.centers.search.filters_note")}</p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={handleNearMe} loading={geoStatus === "locating"}>
            {t("web.centers.near_me")}
          </Button>
          <Button
            variant="outline"
            aria-pressed={activeFilters > 0}
            onClick={() => setShowFilters(true)}
          >
            {t("client.home.filters")}
            {activeFilters > 0 ? (
              <span className="ml-1 rounded-full bg-accent px-1.5 text-[10px] font-bold text-on-accent">
                {activeFilters}
              </span>
            ) : null}
            {activeFilters > 0 ? (
              <span className="sr-only">
                {t("web.centers.map.filters_active_count", { count: activeFilters })}
              </span>
            ) : null}
          </Button>
        </div>

        {/*
          Service chips are only rendered once an authenticated services payload
          can legitimately exist; a guest never sees this row.
        */}
        {showChips ? (
          <div className="mt-4">
            <ServiceChips
              chips={chips.chips}
              selected={chips.selected}
              onSelect={chips.select}
              onViewAll={() => setShowAllCategories(true)}
              loading={chips.loading}
            />
          </div>
        ) : null}

        <p className="sr-only" role="status" aria-live="polite">
          {geolocationAnnouncement}
        </p>

        <div className="mt-8 flex flex-col gap-6">
          {/* ── MAP: primary, always visible ── */}
          <div className="min-w-0">
            {/*
              Ranking period control. It sits with the map, not in a settings
              panel, because it changes what the badges on the map mean; the
              note states the precedence so the visitor understands what is
              plotted (the active featured/search/near-me set) versus what is
              badged (only the centers in this ranking).
            */}
            <div className="mb-3 flex flex-col gap-2">
              <RankingPeriodControl period={rankingPeriod} onChange={setRankingPeriod} />
              <p className="max-w-xl text-xs text-text-muted">
                {t("web.centers.map.ranking_note")}
              </p>
            </div>

            <Suspense fallback={<MapFallback />}>
              <LazyCenterMap
                centers={filteredPlotted}
                language={language}
                userLocation={userLocation}
                selectedCenterId={selectedCenterId}
                ranking={rankingItems}
                favoriteIds={favorites.favoriteIds}
                onSelectCenter={handleSelectCenter}
                onLocateUser={requestLocation}
              />
            </Suspense>

            {featuredLoading || nearbyLoading ? (
              <p className="mt-3 text-sm text-text-muted">
                {nearbyLoading
                  ? t("web.centers.geolocation.locating")
                  : t("web.centers.search.featured_loading")}
              </p>
            ) : null}
          </div>

          {/* ── RESULTS: full-width carousel below the map, every breakpoint ── */}
          <aside
            aria-label={t("web.centers.results.panel_label")}
            className="flex min-w-0 flex-col gap-4"
          >
            <p className="text-sm font-semibold text-text">{t("web.centers.results.title")}</p>

            <div aria-live="polite" aria-busy={isBusy || undefined}>
              {listIdle ? (
                <EmptyState
                  title={t("web.centers.search.idle_title")}
                  body={t("web.centers.search.idle_body")}
                />
              ) : null}

              {nearbyLoading || searchLoading || featuredLoading ? (
                <>
                  <p className="sr-only">
                    {featuredLoading
                      ? t("web.centers.search.featured_loading")
                      : t("web.centers.search.loading")}
                  </p>
                  <CenterResultsSkeleton count={4} gridClassName={PANEL_GRID} />
                </>
              ) : null}

              {featuredFailed ? (
                <div
                  role="alert"
                  className="flex flex-col items-center gap-3 rounded-lg border border-danger/40 px-4 py-10 text-center"
                >
                  <p className="font-semibold text-text">{t("web.centers.search.error_title")}</p>
                  <p className="max-w-md text-sm text-text-muted">
                    {t("web.centers.search.error_body")}
                  </p>
                  <Button variant="outline" onClick={() => void featured.refetch()}>
                    {t("common.retry")}
                  </Button>
                </div>
              ) : null}

              {nearbyFailed ? (
                <GeolocationErrorPanel
                  error={geoError}
                  onRetry={requestLocation}
                  onSearchInstead={() => setNearbyRequested(false)}
                />
              ) : null}

              {searchFailed ? (
                <div
                  role="alert"
                  className="flex flex-col items-center gap-3 rounded-lg border border-danger/40 px-4 py-10 text-center"
                >
                  <p className="font-semibold text-text">{t("web.centers.search.error_title")}</p>
                  <p className="max-w-md text-sm text-text-muted">
                    {errorMessage ?? t("web.centers.search.error_body")}
                  </p>
                  <Button variant="outline" onClick={() => void search.refetch()}>
                    {t("common.retry")}
                  </Button>
                </div>
              ) : null}

              {searchEmpty ? (
                <EmptyState
                  title={t("web.centers.search.empty_title")}
                  body={t("web.centers.search.empty_body")}
                />
              ) : null}

              {nearbyEmpty ? (
                <EmptyState
                  title={t("web.centers.geolocation.no_results_title")}
                  body={t("web.centers.geolocation.no_results_body")}
                />
              ) : null}

              {narrowedEmpty ? (
                <EmptyState
                  title={t("web.centers.map.filters_empty_title")}
                  body={t("web.centers.map.filters_empty_body")}
                />
              ) : null}

              {hasListResults ? (
                <>
                  <p className="mb-4 text-sm font-medium text-text-muted">
                    {nearbyRequested
                      ? t("web.centers.map.nearby_count", { count: displayCount })
                      : isQueryReady
                        ? t("web.centers.search.results_count", { count: displayCount })
                        : t("web.centers.search.featured_count", { count: displayCount })}
                  </p>
                  <CenterResultsList
                    results={visibleList}
                    language={language}
                    selectedCenterId={selectedCenterId}
                    onQuickView={handleSelectCenter}
                  />
                </>
              ) : null}
            </div>
          </aside>
        </div>
      </div>

      <CenterFiltersPanel
        open={showFilters}
        onClose={() => setShowFilters(false)}
        minRating={minRating}
        openNow={openNow}
        ratingAvailable={ratingAvailable}
        openNowAvailable={openNowAvailable}
        resultCount={filteredList.length}
        onMinRatingChange={setMinRating}
        onOpenNowChange={setOpenNow}
      />

      <ServiceCategoryDialog
        open={showAllCategories}
        categories={chips.allCategories}
        selected={chips.selected}
        onSelect={chips.select}
        onClose={() => setShowAllCategories(false)}
      />

      <SelectedCenterSheet
        center={selectedCenter}
        language={language}
        canFavorite={canFavorite}
        isFavorite={selectedCenter ? favorites.isFavorite(selectedCenter.id) : false}
        favoritePending={favorites.isPending}
        favoriteError={favorites.errorKey}
        onToggleFavorite={handleToggleFavorite}
        onClose={() => setSelectedCenter(null)}
      />
    </PublicLayout>
  );
}
