import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import type { WaitlistEntry, WaitlistStatus } from "yotuvia-core";

import {
  Badge,
  Button,
  Card,
  CardContent,
  ConfirmDialog,
  EmptyState,
  Skeleton,
  useToast,
} from "@/presentation/components/ui";
import type { BadgeVariant } from "@/presentation/components/ui";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { useClaimWaitlist, useLeaveWaitlist, useMyWaitlist } from "@/presentation/hooks/use-waitlist";
import { useErrorMessage } from "@/presentation/lib/errors";
import { dateKeyFromApi } from "@/presentation/lib/dates";
import { formatDate, formatTime } from "@/presentation/lib/format";
import { ROUTES, centerDetailPath } from "@/presentation/lib/routes";

/** Live list refresh cadence: an offer can expire between loads. */
const LIVE_POLL_MS = 30_000;

/** Under this remaining window the offer reads as urgent. */
const OFFER_URGENT_MS = 2 * 60_000;

type WaitlistMode = "active" | "history";

/** Badge colour per status (the label always carries the meaning). */
const STATUS_VARIANT: Readonly<Record<WaitlistStatus, BadgeVariant>> = {
  WAITING: "info",
  OFFERED: "success",
  BOOKED: "accent",
  EXPIRED: "default",
  CANCELLED: "danger",
};

/** Single-line countdown for an offered slot. */
function OfferCountdown({ expiresAt }: { expiresAt: string }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(interval);
  }, []);

  const diffMs = new Date(expiresAt).getTime() - now;
  const urgent = diffMs < OFFER_URGENT_MS;
  const minutes = Math.max(0, Math.ceil(diffMs / 60_000));
  const seconds = Math.max(0, Math.ceil(diffMs / 1_000));

  return (
    <p className={urgent ? "text-xs font-semibold text-danger" : "text-xs text-warning"}>
      {diffMs <= 0
        ? t("client.waitlist.offer_expired")
        : urgent
          ? t("client.waitlist.expires_in_seconds", { seconds })
          : t("client.waitlist.expires_in", { minutes })}
    </p>
  );
}

interface WaitlistCardProps {
  entry: WaitlistEntry;
  language: string;
  /** History rows are informational: no claim or leave actions. */
  readOnly: boolean;
  claiming: boolean;
  leaving: boolean;
  onClaim: (entry: WaitlistEntry) => void;
  onLeave: (entry: WaitlistEntry) => void;
}

function WaitlistCard({
  entry,
  language,
  readOnly,
  claiming,
  leaving,
  onClaim,
  onLeave,
}: WaitlistCardProps) {
  const { t } = useTranslation();
  const centerName = entry.beautyCenter?.name?.trim()
    ? entry.beautyCenter.name
    : t("client.reservations.center_prefix", { id: entry.beautyCenterId });
  const isOffered = entry.status === "OFFERED";
  const isWaiting = entry.status === "WAITING";

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Link
            to={centerDetailPath(entry.beautyCenterId)}
            className="min-w-0 truncate text-sm font-semibold text-text hover:underline"
          >
            {centerName}
          </Link>
          <Badge variant={STATUS_VARIANT[entry.status]}>
            {t(`client.waitlist.status_${entry.status.toLowerCase()}`)}
          </Badge>
        </div>

        <dl className="flex flex-col gap-1 text-xs text-text-muted">
          <div className="flex gap-x-2">
            <dd>{formatDate(dateKeyFromApi(entry.date), language)}</dd>
          </div>
          <div className="flex gap-x-2">
            <dd>
              {formatTime(entry.startTime)} – {formatTime(entry.endTime)}
            </dd>
          </div>
          {isWaiting && entry.position > 0 ? (
            <div className="flex gap-x-2">
              <dd>{t("client.waitlist.position", { position: entry.position })}</dd>
            </div>
          ) : null}
        </dl>

        {isOffered && !readOnly && entry.offerExpiresAt ? (
          <OfferCountdown expiresAt={entry.offerExpiresAt} />
        ) : null}

        {!readOnly && (isOffered || isWaiting) ? (
          <div className="flex flex-wrap items-center gap-2">
            {isOffered ? (
              <Button size="sm" onClick={() => onClaim(entry)} loading={claiming}>
                {t("client.waitlist.claim")}
              </Button>
            ) : null}
            {isWaiting ? (
              <Button size="sm" variant="danger" onClick={() => onLeave(entry)} disabled={leaving}>
                {t("client.waitlist.leave")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * The signed-in client's waitlist.
 *
 * ACTIVE vs HISTORY: the live tab polls (an offer can expire between loads); the
 * history tab is fetched once when selected and never reruns on the timer.
 *
 * JOINING is intentionally NOT offered here: the API requires a concrete
 * `start_time` + `personnel_id`, and the web booking flow only exposes slots the
 * center has FREE, so there is no conflicting slot to wait for on this surface
 * yet. Entries created on mobile are managed (claimed / left) here.
 */
export function WaitlistPage() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t("client.waitlist.title"));

  const language = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const { toast } = useToast();

  const [mode, setMode] = useState<WaitlistMode>("active");
  const [leaving, setLeaving] = useState<WaitlistEntry | null>(null);
  const [claimingId, setClaimingId] = useState<number | null>(null);

  const activeQuery = useMyWaitlist(false, { refetchInterval: LIVE_POLL_MS });
  const historyQuery = useMyWaitlist(true, { enabled: mode === "history" });
  const claimMutation = useClaimWaitlist();
  const leaveMutation = useLeaveWaitlist();

  const query = mode === "history" ? historyQuery : activeQuery;
  const entries = query.data ?? [];
  const errorMessage = useErrorMessage(query.error, "web.errors.waitlist_fetch");

  const handleClaim = async (entry: WaitlistEntry) => {
    if (claimingId !== null) return;
    setClaimingId(entry.id);
    try {
      await claimMutation.mutateAsync(entry.id);
      toast(t("client.waitlist.claimed"), { variant: "success" });
      navigate(ROUTES.client.reservations);
    } catch {
      // `claimMutation.errorKey` is surfaced on the card's action.
    } finally {
      setClaimingId(null);
    }
  };

  const handleConfirmLeave = async () => {
    if (leaving === null) return;
    try {
      await leaveMutation.mutateAsync(leaving.id);
      setLeaving(null);
    } catch {
      // `leaveMutation.errorKey` keeps the dialog open with the message.
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-text">{t("client.waitlist.title")}</h2>
      </div>

      <div role="tablist" className="flex gap-2">
        {(["active", "history"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={
              mode === value
                ? "rounded-full border border-accent px-3 py-1 text-sm font-semibold text-text"
                : "rounded-full border border-border px-3 py-1 text-sm text-text-muted"
            }
          >
            {value === "active" ? t("client.waitlist.tab_active") : t("client.waitlist.tab_history")}
          </button>
        ))}
      </div>

      {claimMutation.errorKey ? (
        <p role="alert" className="text-sm text-danger">
          {t(claimMutation.errorKey)}
        </p>
      ) : null}

      {query.isPending ? (
        <div role="status" aria-live="polite" aria-label={t("common.loading")} className="flex flex-col gap-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : query.isError ? (
        <Card role="alert">
          <CardContent className="flex flex-col gap-4 p-4">
            <p className="text-sm text-text-muted">{errorMessage}</p>
            <Button variant="outline" className="self-start" onClick={() => void query.refetch()}>
              {t("common.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-8 text-center">
            <EmptyState
              title={
                mode === "history" ? t("client.waitlist.history_empty") : t("client.waitlist.empty")
              }
              body={
                mode === "history"
                  ? t("client.waitlist.history_empty_sub")
                  : t("client.waitlist.empty_sub")
              }
            />
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li key={entry.id}>
              <WaitlistCard
                entry={entry}
                language={language}
                readOnly={mode === "history"}
                claiming={claimingId === entry.id}
                leaving={leaveMutation.isPending && leaving?.id === entry.id}
                onClaim={(value) => void handleClaim(value)}
                onLeave={setLeaving}
              />
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={leaving !== null}
        title={t("client.waitlist.leave_confirm_title")}
        description={t("client.waitlist.leave_confirm_body")}
        confirmLabel={t("client.waitlist.confirm")}
        cancelLabel={t("client.waitlist.cancel")}
        closeLabel={t("common.close")}
        loading={leaveMutation.isPending}
        error={leaveMutation.errorKey ? t(leaveMutation.errorKey) : null}
        onConfirm={() => void handleConfirmLeave()}
        onCancel={() => setLeaving(null)}
      />
    </div>
  );
}
