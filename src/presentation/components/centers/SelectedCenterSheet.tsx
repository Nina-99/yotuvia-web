import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { BeautyCenter } from "yotuvia-core";

import { Badge, Button, Modal, buttonClasses } from "@/presentation/components/ui";
import { isOpenNow } from "@/presentation/lib/is-open-now";
import { formatNumber, formatRating } from "@/presentation/lib/format";
import { ROUTES, centerDetailPath } from "@/presentation/lib/routes";

/**
 * Booking call to action shown in the selected-center sheet.
 *
 * `requiresAuth` marks the GUEST case: the sheet then renders an auth gate
 * (sign in / create account) that carries the booking URL as the intended
 * destination, instead of a link to a route the guest cannot open. A signed-in
 * client gets a direct link to the booking flow.
 */
export interface SelectedCenterBooking {
  /** Path that starts the booking (client) or is stashed as the destination (guest). */
  href: string;
  /** When true the visitor must sign in first. */
  requiresAuth: boolean;
}

export interface SelectedCenterSheetProps {
  /** The selected center, or `null` when the sheet is closed. */
  center: BeautyCenter | null;
  /** Active i18n language, used to localize the rating and review count. */
  language: string;
  /** Whether this visitor may toggle favourites (signed-in clients only). */
  canFavorite: boolean;
  /** Whether the selected center is currently saved. */
  isFavorite: boolean;
  /** Whether a favourite toggle is in flight. */
  favoritePending: boolean;
  /** i18n key of the last favourite failure, or `null`. */
  favoriteError: string | null;
  /** Adds or removes the selected center from favourites. */
  onToggleFavorite: () => void;
  /**
   * Booking CTA. Omitted when the viewer must not book (e.g. a signed-in owner):
   * the sheet then shows only the public details link.
   */
  booking?: SelectedCenterBooking;
  onClose: () => void;
}

/**
 * Selected-center sheet for the public center map.
 *
 * This is the web counterpart of the mobile carousel/bottom sheet: selecting a
 * marker (or a list card's quick view) opens a card with the center's key facts
 * and a link to its PUBLIC detail page. It is deliberately built on the shared
 * `Modal`, so it is keyboard reachable, dismissible with Escape and traps focus
 * without any bespoke chrome.
 *
 * The "Save center" control only renders for a visitor who may actually call the
 * favourites API (`canFavorite`, i.e. a signed-in client), announcing its state
 * through `aria-pressed`. Open/closed is shown ONLY when the center carries
 * schedules; with no schedule data the sheet makes no claim either way.
 *
 * BOOKING GATE: a guest never gets a link into the client-only booking route.
 * The CTA becomes an explicit "sign in to book" gate whose link preserves the
 * booking destination in the location state, so the visitor lands back on the
 * booking flow after authenticating.
 */
export function SelectedCenterSheet({
  center,
  language,
  canFavorite,
  isFavorite,
  favoritePending,
  favoriteError,
  onToggleFavorite,
  booking,
  onClose,
}: SelectedCenterSheetProps) {
  const { t } = useTranslation();

  const name = center?.name.trim() ? center.name : t("web.home.search.unknown_center");
  const address = center?.address.trim() ?? "";
  const hasRating = typeof center?.averageRating === "number" && center.averageRating > 0;
  const openStatus = center ? isOpenNow(center.schedules) : null;

  // The booking destination travels as `state.from`, the shape
  // `resolveRedirectPath` reads on the login/register side.
  const bookingDestination =
    booking !== undefined ? { from: { pathname: booking.href } } : undefined;

  const footer = (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <Link
        to={center ? centerDetailPath(center.id) : "#"}
        className={buttonClasses({ variant: "outline", size: "md" })}
      >
        {t("web.centers.map.sheet_view_details")}
      </Link>

      {booking === undefined ? null : booking.requiresAuth ? (
        <>
          <Link
            to={ROUTES.login}
            state={bookingDestination}
            className={buttonClasses({ variant: "primary", size: "md" })}
          >
            {t("web.centers.map.sheet_sign_in_to_book")}
          </Link>
          <Link
            to={ROUTES.register}
            state={bookingDestination}
            className={buttonClasses({ variant: "outline", size: "md" })}
          >
            {t("web.centers.map.sheet_create_account")}
          </Link>
        </>
      ) : (
        <Link
          to={booking.href}
          className={buttonClasses({ variant: "primary", size: "md" })}
        >
          {t("web.centers.map.sheet_book")}
        </Link>
      )}
    </div>
  );

  return (
    <Modal
      open={center !== null}
      onClose={onClose}
      closeLabel={t("common.close")}
      title={name}
      description={address || undefined}
      footer={footer}
    >
      <div className="flex flex-col gap-3">
        {hasRating ? (
          <p className="flex items-center gap-2 text-sm text-text-muted">
            <span aria-hidden="true">★</span>
            {t("web.home.search.rating_reviews", {
              rating: formatRating(center?.averageRating ?? 0, language),
              count: formatNumber(center?.reviewCount ?? 0, language),
            })}
          </p>
        ) : (
          <Badge>{t("web.home.search.no_rating")}</Badge>
        )}

        {/*
          With no schedule data the sheet claims nothing, instead of labelling
          every center "closed" (which is not what a missing field means).
        */}
        {openStatus?.hasSchedules ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span
              className={
                openStatus.isOpen
                  ? "font-medium text-success"
                  : "font-medium text-danger"
              }
            >
              {openStatus.isOpen
                ? t("client.home.open_now")
                : t("components.bottom_sheet.closed_now")}
            </span>
            {openStatus.todayHours ? (
              <span className="text-text-muted" dir="ltr">
                {t("web.centers.map.sheet_today_hours", { hours: openStatus.todayHours })}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Explicit, visible gate: a guest is told an account is needed to book. */}
        {booking?.requiresAuth ? (
          <p className="rounded-lg border border-border bg-card2 px-3 py-2 text-sm text-text-muted">
            {t("web.centers.map.sheet_book_guest_hint")}
          </p>
        ) : null}

        {canFavorite ? (
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            aria-pressed={isFavorite}
            loading={favoritePending}
            onClick={onToggleFavorite}
          >
            {isFavorite
              ? t("web.centers.detail.favorite_saved")
              : t("web.centers.detail.favorite_add")}
          </Button>
        ) : null}

        {favoriteError ? (
          <p role="alert" className="text-sm text-danger">
            {t(favoriteError, { defaultValue: favoriteError })}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
