import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { BeautyCenter } from "yotuvia-core";

import { CenterResultCard } from "@/presentation/components/centers/CenterResultCard";
import { Button } from "@/presentation/components/ui";
import { cn } from "@/presentation/lib/cn";

/**
 * Gap between cards, kept in lockstep with the `gap-4` utility below so a
 * paging step lands on a snap point instead of between two cards.
 */
const CAROUSEL_GAP_PX = 16;

export interface CenterResultsListProps {
  /** Centers to render, already filtered and ordered by the caller. */
  results: BeautyCenter[];
  /** Active i18n language, forwarded to each card. */
  language: string;
  /** Id highlighted as selected (mirrored from the map). */
  selectedCenterId?: number | null;
  /**
   * Explicitly activates a center (mirrors the choice onto the map and opens
   * the selected-center sheet). Bound only to each card's quick-view button —
   * never to hover or focus.
   */
  onQuickView?: (center: BeautyCenter) => void;
}

/**
 * Shared result list for the PUBLIC center surfaces.
 *
 * ONE layout at every breakpoint: a HORIZONTAL, scroll-snap carousel that sits
 * BELOW the map and spans the page width. It replaces the old split where the
 * results were a narrow sticky SIDE panel next to the map on `lg+` — the side
 * panel squeezed the cards and revealed fewer of them than the map deserved.
 * The map now owns the full content width and the cards read as a browsing
 * strip underneath it. Because the landing and `/centers` render this exact
 * component, the two surfaces cannot drift apart.
 *
 * KEYBOARD AND SCREEN READERS: the scroll container is a focus stop
 * (`tabIndex={0}`) with an accessible name, so a keyboard user can focus it and
 * scroll it with the arrow keys. Every card stays a real link, so the carousel
 * remains the complete, accessible path to every center and the map is never
 * the only way in. Nothing is `hidden` or clipped out of the accessibility
 * tree: the cards scroll, they do not disappear.
 *
 * SCROLLING: the prev/next controls call `scrollBy` on the container itself, so
 * only the carousel moves — the page's `scroll-behavior: smooth` (set on
 * `html`) is never asked to scroll and cannot hijack the strip. The container
 * also pins `scroll-auto` so the step is deterministic and instant; the
 * controls scroll rather than animate, so they stay visible under
 * `prefers-reduced-motion` too.
 */
export function CenterResultsList({
  results,
  language,
  selectedCenterId = null,
  onQuickView,
}: CenterResultsListProps) {
  const { t } = useTranslation();
  const listRef = useRef<HTMLUListElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const syncScrollState = useCallback(() => {
    const node = listRef.current;
    if (node === null) return;
    const maxScrollLeft = node.scrollWidth - node.clientWidth;
    setCanScrollPrev(node.scrollLeft > 1);
    setCanScrollNext(maxScrollLeft > 1 && node.scrollLeft < maxScrollLeft - 1);
  }, []);

  useEffect(() => {
    syncScrollState();
    window.addEventListener("resize", syncScrollState);
    return () => window.removeEventListener("resize", syncScrollState);
  }, [results, syncScrollState]);

  const scrollByPage = useCallback(
    (direction: -1 | 1) => {
      const node = listRef.current;
      if (node === null || typeof node.scrollBy !== "function") return;
      const firstCard = node.querySelector("li");
      const cardWidth = firstCard ? firstCard.getBoundingClientRect().width : 0;
      // Never step by zero: fall back to a viewport-wide page when the card
      // width is not measurable yet.
      const step = Math.max(cardWidth + CAROUSEL_GAP_PX, node.clientWidth);
      node.scrollBy({ left: direction * step, behavior: "auto" });
      syncScrollState();
    },
    [syncScrollState],
  );

  return (
    <div className="flex flex-col gap-2">
      {/*
        Desktop mouse affordance. Both controls exist at every breakpoint and
        are disabled — not removed — when that end has nothing to scroll, so the
        strip's state is discoverable and the layout never jumps.
      */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          aria-label={t("web.centers.results.prev")}
          onClick={() => scrollByPage(-1)}
          disabled={!canScrollPrev}
        >
          <span aria-hidden="true">‹</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          aria-label={t("web.centers.results.next")}
          onClick={() => scrollByPage(1)}
          disabled={!canScrollNext}
        >
          <span aria-hidden="true">›</span>
        </Button>
      </div>

      <ul
        ref={listRef}
        role="list"
        tabIndex={0}
        aria-label={t("web.centers.results.list_label")}
        onScroll={syncScrollState}
        className={cn(
          "flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-auto pb-2",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        {/*
          Fixed width + snap point at EVERY breakpoint: the card keeps its
          horizontal (image + text) shape instead of squashing into a grid cell,
          and the strip scrolls when the row is wider than the page.
        */}
        {results.map((center) => (
          <li key={center.id} className="w-[85vw] max-w-sm shrink-0 snap-start">
            <CenterResultCard
              center={center}
              language={language}
              selected={selectedCenterId === center.id}
              onQuickView={onQuickView ? () => onQuickView(center) : undefined}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
