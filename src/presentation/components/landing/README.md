# Landing page

Public, read-only landing page rendered at `/` by
`src/presentation/pages/HomePage.tsx`. It composes the sections in this folder
inside `PublicLayout` (header, footer, language switcher, theme toggle).

## Where to edit things

| What you want to change | Where |
| --- | --- |
| Any user-facing text (EN/ES) | `src/presentation/i18n/locales/en.json` and `es.json`, under `web.home.*` |
| Document title + meta description | `web.home.meta.*` (title is applied by `useDocumentTitle`); static meta/Open Graph tags live in `index.html` |
| Brand name in the header/footer | `web.layout.brand_name` (used by `PublicLayout`) |
| Pricing numbers, names, taglines, features | `src/presentation/lib/token-tiers.ts` (mirrors `yotuvia-api/configs/tiers.json`) and `web.home.pricing.*` for the copy |
| FAQ questions/answers | `web.home.faq.q1..q5` / `web.home.faq.a1..a5` |
| Where a center card links | `centerDetailPath(centerId)` in `src/presentation/lib/routes.ts` (single source of truth; the card itself lives in `src/presentation/components/centers/`) |
| Starting a full search | The header/footer "Centers" link and the hero CTA point at `ROUTES.centers.search` (`/centers`); the search section links there too with `?term=` |
| Section order | `src/presentation/pages/HomePage.tsx` |
| Colors, radii, dark mode tokens | `src/index.css` (Tailwind classes like `bg-card`, `text-text-muted`, `text-accent`) |
| Icons | `src/presentation/components/landing/icons.tsx` (inline SVG, no icon dependency) |

## Sections

| Component | Anchor | Purpose |
| --- | --- | --- |
| `HeroSection` | — | Headline, CTAs, CSS-only product preview, trust strip |
| `CenterSearchSection` | `#centers` | Shared map (lazy) + results list, seeded with the public featured set; booking CTA is gated for guests |
| `OwnerFeaturesSection` | `#features` | Agenda, clients, services, staff, loyalty, tokens, content |
| `ClientFeaturesSection` | — | Discover, book, waitlist |
| `HowItWorksSection` | `#how-it-works` | Three-step flow |
| `PricingSection` | `#pricing` | Real YOTUVIA token bonus ladder (USD + VES), no invented plans |
| `FaqSection` | `#faq` | Accessible accordion (`aria-expanded` / `aria-controls`) |
| `FinalCtaSection` | `#contact` | Closing CTA band |

## Notes

- All copy goes through `t()`; no user-facing string is hardcoded in a component.
- The pricing numbers live in `src/presentation/lib/token-tiers.ts`, mirrored from
  `yotuvia-api/configs/tiers.json` (the API's ladder is the source of truth); the
  section renders the real bonus percentages and states there is no card gateway.
- The "find a center" section renders the SAME `CenterMap` as the client-area
  search page, using the same public hooks (`useSearchBeautyCenters`,
  `useTopRatedCenters`, `useCenterRanking`). MapLibre is code-split and its mount
  is deferred until the section scrolls into view, so it never joins the entry
  chunk. A guest makes only public requests; the booking CTA becomes a sign-in /
  create-account gate that preserves the booking destination.
- The search reads from `useSearchBeautyCenters` and `useCategoryTemplates`
  (`@/presentation/hooks`). `en.json` and `es.json` must keep identical keys —
  the `locale-parity` test enforces this.
- The center search API has no category parameter, so the selected category is
  appended to the search term. Revisit this when a server-side filter exists.
- `GET /category/templates` requires a JWT, so the category picker is rendered
  and requested ONLY for a signed-in visitor: as a guest the request would answer
  401 and the API client would sign the anonymous visitor out to `/login`,
  breaking the public landing.
- Center cards come from `components/centers/CenterResultCard`, shared with the
  public search page so a center looks the same everywhere it is listed. The
  card is HORIZONTAL (cover image left, information right) and the results are
  laid out by the shared `components/centers/CenterResultsList` as a horizontal
  scroll-snap carousel BELOW the full-width map — the same carousel at every
  breakpoint, with prev/next controls, so the landing and `/centers` never
  diverge. Hovering a card is purely visual; the center is only selected (sheet
  opened) through the card's quick-view button.
- `ScrollProgress` renders the thin accent bar at the top of the page and
  `HeroSection` carries a subtle scroll-linked drift. Both hand the work to CSS
  scroll-driven animations where supported and fall back to an rAF-throttled
  transform; both stand down under `prefers-reduced-motion`. In-page anchors
  smooth-scroll via `scroll-behavior` in `src/index.css`, with `scroll-margin-top`
  so the sticky header never covers the target.
