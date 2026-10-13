/** The two public legal documents. */
export type LegalPage = "terms" | "privacy";

/**
 * Section ids per document, in reading order.
 *
 * Kept here (not in the locale files) so both locales are forced to expose the
 * same structure: the table of contents, the anchors and the rendered sections
 * all read from this ONE list. Living in a non-component module keeps the
 * `react-refresh` rule happy (`LegalDocument.tsx` only exports a component).
 */
export const LEGAL_SECTION_IDS: Readonly<Record<LegalPage, readonly string[]>> = {
  terms: [
    "acceptance",
    "provider",
    "service",
    "accounts",
    "tokens",
    "acceptable_use",
    "bookings",
    "content",
    "availability",
    "liability",
    "termination",
    "law",
    "contact",
  ],
  privacy: [
    "controller",
    "collected",
    "usage",
    "legal_basis",
    "sharing",
    "retention",
    "security",
    "rights",
    "cookies",
    "transfers",
    "children",
    "changes",
    "contact",
  ],
};
