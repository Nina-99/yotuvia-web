import type { BadgeVariant } from "@/presentation/components/ui";

/**
 * Maps a top-up status to its translated label key and badge variant.
 *
 * Status is always rendered as text (never colour alone) so it stays legible
 * for colour-blind users and screen readers.
 */
export interface TopUpStatusMeta {
  labelKey: string;
  variant: BadgeVariant;
}

const STATUS_META: Readonly<Record<string, TopUpStatusMeta>> = {
  pending: { labelKey: "web.app.tokens.status.pending", variant: "warning" },
  approved: { labelKey: "web.app.tokens.status.approved", variant: "success" },
  rejected: { labelKey: "web.app.tokens.status.rejected", variant: "danger" },
};

/** Resolves status metadata, falling back to an explicit "unknown" label. */
export function topUpStatusMeta(status: string): TopUpStatusMeta {
  return (
    STATUS_META[status] ?? { labelKey: "web.app.tokens.status.unknown", variant: "default" }
  );
}
