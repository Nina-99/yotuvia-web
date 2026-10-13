import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Reservation, ReservationStatus } from "yotuvia-core";

import {
  CancelReservationDialog,
  ClientReservationCard,
  ClientReservationDetail,
  ReservationQrDialog,
} from "@/presentation/components/client";
import { Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Select, Skeleton, useToast } from "@/presentation/components/ui";
import { useAuthSession } from "@/presentation/hooks/use-auth-session";
import {
  useCancelClientReservation,
  useClientReservations,
  useGenerateReservationQr,
} from "@/presentation/hooks/use-client";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { useErrorMessage } from "@/presentation/lib/errors";
/** Filter sentinel for "every status". */
const ALL = "ALL";

/** Filter options, matching `ReservationStatus` plus the all-values sentinel. */
const STATUS_FILTERS: readonly (ReservationStatus | typeof ALL)[] = [
  ALL,
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];

/** Narrows a raw `<select>` value back to the known filter union. */
function isStatusFilter(value: string): value is ReservationStatus | typeof ALL {
  return (STATUS_FILTERS as readonly string[]).includes(value);
}

/**
 * The signed-in client's reservations.
 *
 * DATA SHAPE: `GET /reservation/client/:clientId` returns the WHOLE history in
 * one array (`GetClientReservationsUseCase.execute(clientId)`): the endpoint has
 * NO pagination and NO status filter, so the status selector filters the loaded
 * array client-side and the list is rendered in the server's order
 * (`date DESC, start_time DESC` — newest first). The page states the filtering
 * scope to the user instead of pretending it is a server query.
 *
 * ACTIONS, and only the ones the API supports:
 * - detail -> read-only view of the payload;
 * - QR -> `generateQRUseCase` on demand (the token replaces the previous one and
 *   expires in 30 minutes, so it is never fetched on render);
 * - cancel -> `cancelReservationUseCase` behind a confirmation; the backend
 *   accepts it only for PENDING/CONFIRMED, so the action is hidden otherwise.
 */
export function ClientReservationsPage() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t("client.reservations.meta_title"));

  const { user } = useAuthSession();
  const clientId = Number(user?.id ?? 0);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState<ReservationStatus | typeof ALL>(ALL);
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [cancelling, setCancelling] = useState<Reservation | null>(null);
  const [qrReservation, setQrReservation] = useState<Reservation | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);

  const reservationsQuery = useClientReservations(clientId);
  const cancelMutation = useCancelClientReservation();
  const qrMutation = useGenerateReservationQr();

  const errorMessage = useErrorMessage(
    reservationsQuery.error,
    "web.errors.client_reservations_fetch",
  );

  const reservations = useMemo(() => reservationsQuery.data ?? [], [reservationsQuery.data]);
  const filtered = useMemo(
    () =>
      statusFilter === ALL
        ? reservations
        : reservations.filter((reservation) => reservation.status === statusFilter),
    [reservations, statusFilter],
  );

  const requestQr = async (reservation: Reservation) => {
    setQrReservation(reservation);
    setQrToken(null);
    try {
      setQrToken(await qrMutation.mutateAsync(reservation.id));
    } catch {
      // `qrMutation.errorKey` drives the dialog's error state.
    }
  };

  const handleOpenDetail = (reservation: Reservation) => {
    setSelected(reservation);
  };

  /**
   * Opens the check-in code.
   *
   * The detail modal is closed first on purpose: two `Modal`s stack two focus
   * traps on `document`, so only one dialog is ever open at a time.
   */
  const handleShowQr = (reservation: Reservation) => {
    setSelected(null);
    void requestQr(reservation);
  };

  const handleRequestCancel = (reservation: Reservation) => {
    setSelected(null);
    setCancelling(reservation);
  };

  const handleConfirmCancel = async (reason: string) => {
    if (cancelling === null) return;
    const trimmed = reason.trim();
    try {
      await cancelMutation.mutateAsync({
        reservationId: cancelling.id,
        reason: trimmed === "" ? undefined : trimmed,
      });
      setCancelling(null);
      toast(t("client.reservations.cancel_success"), { variant: "success" });
    } catch {
      // `cancelMutation.errorKey` keeps the dialog open with the message.
    }
  };

  if (clientId <= 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("client.reservations.error_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-muted">{t("client.home.no_client")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-text">{t("client.reservations.title")}</h2>
        <p className="text-sm text-text-secondary">
          {t("client.reservations.total", { count: reservations.length })}
        </p>
      </div>

      <div className="flex flex-col gap-1 sm:max-w-xs">
        <Select
          label={t("web.app.agenda.filter.label")}
          value={statusFilter}
          onChange={(event) => {
            const next = event.target.value;
            setStatusFilter(isStatusFilter(next) ? next : ALL);
          }}
        >
          {STATUS_FILTERS.map((status) => (
            <option key={status} value={status}>
              {status === ALL
                ? t("web.app.agenda.filter.all")
                : t(`client.status.${status.toLowerCase()}`)}
            </option>
          ))}
        </Select>
        <p className="text-xs text-text-secondary">{t("client.reservations.filter_hint")}</p>
      </div>

      {reservationsQuery.isPending ? (
        <div
          role="status"
          aria-live="polite"
          aria-label={t("common.loading")}
          className="flex flex-col gap-3"
        >
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-40 w-full" />
          ))}
        </div>
      ) : reservationsQuery.isError ? (
        <Card role="alert">
          <CardHeader>
            <CardTitle>{t("client.reservations.error_title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-text-muted">{errorMessage}</p>
            <Button
              variant="outline"
              className="self-start"
              onClick={() => void reservationsQuery.refetch()}
            >
              {t("common.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : reservations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-8 text-center">
            <EmptyState
              title={t("client.reservations.empty")}
              body={t("client.reservations.empty_body")}
            />
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-8 text-center">
            <p className="text-base font-semibold text-text">
              {t("client.reservations.empty_filter")}
            </p>
            <p className="text-sm text-text-muted">{t("client.reservations.empty_filter_body")}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((reservation) => (
            <li key={reservation.id}>
              <ClientReservationCard
                reservation={reservation}
                language={language}
                onOpenDetail={handleOpenDetail}
                onShowQr={handleShowQr}
                onCancel={handleRequestCancel}
              />
            </li>
          ))}
        </ul>
      )}

      <ClientReservationDetail
        reservation={selected}
        language={language}
        onClose={() => setSelected(null)}
        onShowQr={() => {
          if (selected !== null) handleShowQr(selected);
        }}
        onCancel={() => {
          if (selected !== null) handleRequestCancel(selected);
        }}
      />

      <ReservationQrDialog
        open={qrReservation !== null}
        reservation={qrReservation}
        token={qrToken}
        loading={qrMutation.isPending}
        errorKey={qrMutation.errorKey}
        onRetry={() => {
          if (qrReservation !== null) void requestQr(qrReservation);
        }}
        onClose={() => {
          setQrReservation(null);
          setQrToken(null);
        }}
      />

      <CancelReservationDialog
        open={cancelling !== null}
        reservation={cancelling}
        language={language}
        loading={cancelMutation.isPending}
        errorKey={cancelMutation.errorKey}
        onConfirm={(reason) => void handleConfirmCancel(reason)}
        onCancel={() => setCancelling(null)}
      />
    </div>
  );
}
