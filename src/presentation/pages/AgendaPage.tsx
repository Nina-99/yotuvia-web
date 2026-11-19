import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { imageUrl, isSafeAssetUrl } from "yotuvia-core";
import type { Reservation, ReservationStatus } from "yotuvia-core";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Modal,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from "@/presentation/components/ui";
import type { BadgeVariant } from "@/presentation/components/ui";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { useAuthSession } from "@/presentation/hooks/use-auth-session";
import { QrCheckInPanel } from "@/presentation/components/staff";
import { useCenterPersonnel } from "@/presentation/hooks/use-personnel";
import {
  useDeleteVisitNote,
  useUpsertVisitNote,
  useVisitNotes,
} from "@/presentation/hooks/use-visit-notes";
import {
  useAssignPersonnel,
  useCenterReservations,
  useReviewProof,
  useUpdateReservationStatus,
} from "@/presentation/hooks/use-reservations";
import { addDays, dateKeyFromApi, isToday, startOfWeek, timeSection, toDateKey } from "@/presentation/lib/dates";
import type { TimeSection } from "@/presentation/lib/dates";
import { toErrorKey, useErrorMessage } from "@/presentation/lib/errors";
import { formatCurrency, formatDate, formatTime } from "@/presentation/lib/format";

type AgendaMode = "day" | "week";
type StatusFilter = ReservationStatus | "ALL";

const STATUS_VARIANT: Readonly<Record<ReservationStatus, BadgeVariant>> = {
  PENDING: "warning",
  CONFIRMED: "info",
  COMPLETED: "success",
  CANCELLED: "danger",
  NO_SHOW: "default",
};

/** Status tabs mirrored from the mobile agenda (NO_SHOW is display-only). */
const STATUS_FILTERS: readonly StatusFilter[] = [
  "ALL",
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
];

/** Allowed transitions — the use-case rejects anything outside this set. */
const STATUS_ACTIONS: Readonly<
  Record<string, readonly { status: string; labelKey: string }[]>
> = {
  PENDING: [
    { status: "CONFIRMED", labelKey: "web.app.agenda.actions.confirm" },
    { status: "CANCELLED", labelKey: "web.app.agenda.actions.cancel" },
  ],
  CONFIRMED: [
    { status: "COMPLETED", labelKey: "web.app.agenda.actions.complete" },
    { status: "CANCELLED", labelKey: "web.app.agenda.actions.cancel" },
  ],
};

const SECTION_ORDER: readonly TimeSection[] = ["morning", "afternoon", "evening"];

function statusLabelKey(status: string): string {
  return `web.app.agenda.status.${status.toLowerCase()}`;
}

function clientNameOf(reservation: Reservation): string | null {
  if (reservation.clientName) return reservation.clientName;
  if (reservation.client) {
    return `${reservation.client.firstName} ${reservation.client.lastName}`.trim();
  }
  return null;
}

function personnelNameOf(reservation: Reservation): string | null {
  if (reservation.personnel) {
    return `${reservation.personnel.firstName} ${reservation.personnel.lastName}`.trim();
  }
  return null;
}

function byStartTime(a: Reservation, b: Reservation): number {
  return a.startTime.localeCompare(b.startTime);
}

interface ReservationRowProps {
  reservation: Reservation;
  revealIndex: number;
  language: string;
  onStatusAction: (reservationId: number, status: string) => void;
  onReviewProof: (reservationId: number, approve: boolean) => void;
  onReassign: (reservation: Reservation) => void;
  /** The owner's own note on this visit, if any. */
  note?: string;
  onEditNote: (reservation: Reservation) => void;
  busy: boolean;
}

function ReservationRow({
  reservation,
  revealIndex,
  language,
  onStatusAction,
  onReviewProof,
  onReassign,
  note,
  onEditNote,
  busy,
}: ReservationRowProps) {
  const { t } = useTranslation();
  const variant = STATUS_VARIANT[reservation.status] ?? "default";
  const clientName =
    clientNameOf(reservation) ?? t("web.app.agenda.client_fallback", { id: reservation.clientId });
  const personnelName = personnelNameOf(reservation);
  const actions = STATUS_ACTIONS[reservation.status] ?? [];
  const currency = reservation.currency ?? "USD";

  return (
    <li
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 ytv-stagger"
      style={{ "--ytv-reveal-delay": `${Math.min(revealIndex * 60, 300)}ms` } as CSSProperties}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-text">
          {t("web.app.agenda.time_range", {
            start: formatTime(reservation.startTime),
            end: formatTime(reservation.endTime),
          })}
        </span>
        <Badge variant={variant}>{t(statusLabelKey(reservation.status))}</Badge>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-text">{clientName}</span>
        <span className="text-xs text-text-muted">
          {t("web.app.agenda.services")}:{" "}
          {reservation.services.map((service) => service.serviceName).join(", ")}
        </span>
        <span className="text-xs text-text-muted">
          {t("web.app.agenda.professional")}:{" "}
          {personnelName ?? t("web.app.agenda.unassigned")}
        </span>
      </div>

      {note ? (
        <p className="whitespace-pre-wrap rounded-md bg-card2 p-2 text-xs text-text">{note}</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold text-success">
          {formatCurrency(reservation.totalPrice, language, currency)}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => onEditNote(reservation)}>
            {note ? t("web.visit_notes.edit") : t("web.visit_notes.add")}
          </Button>
          {actions.length > 0 ? (
            <>
              {(reservation.status === "PENDING" || reservation.status === "CONFIRMED") ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => onReassign(reservation)}
                >
                  {t("web.app.agenda.actions.reassign")}
                </Button>
              ) : null}
              {actions.map((action) => (
                <Button
                  key={action.status}
                  size="sm"
                  variant={action.status === "CANCELLED" ? "danger" : "secondary"}
                  disabled={busy}
                  onClick={() => onStatusAction(reservation.id, action.status)}
                >
                  {t(action.labelKey)}
                </Button>
              ))}
            </>
          ) : null}
        </div>
      </div>

      {reservation.paymentStatus === "PENDING_PROOF" ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card2 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-text">
              {t("web.app.agenda.proof.title")}
            </span>
            {typeof reservation.depositAmount === "number" ? (
              <span className="text-sm font-bold text-text">
                {t("web.app.agenda.proof.amount", {
                  amount: formatCurrency(reservation.depositAmount, language, currency),
                })}
              </span>
            ) : null}
          </div>
          {isSafeAssetUrl(reservation.proofImageUrl) ? (
            <a
              href={imageUrl(reservation.proofImageUrl)}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-link underline"
            >
              {t("web.app.agenda.proof.view")}
            </a>
          ) : null}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="danger"
              disabled={busy}
              onClick={() => onReviewProof(reservation.id, false)}
            >
              {t("web.app.agenda.proof.reject")}
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={busy}
              onClick={() => onReviewProof(reservation.id, true)}
            >
              {t("web.app.agenda.proof.approve")}
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

interface Section {
  key: string;
  title: string;
  items: Reservation[];
}

/**
 * Center agenda at the app agenda route.
 *
 * Day view sections the selected day's reservations by time of day; week view
 * sections the whole week by weekday. Reservations are fetched per visible
 * range (`from`/`to`) because the endpoint has no pagination.
 *
 * TODO(Fase 4B): walk-in booking (`createAdminReservationUseCase`) needs a
 * client picker plus a service multi-select; it is deliberately deferred from
 * this work unit and documented in the apply report.
 */
export function AgendaPage() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t("web.app.agenda.meta.title"));

  const { user } = useAuthSession();
  const centerId = Number(user?.id ?? 0);
  const language = i18n.resolvedLanguage ?? i18n.language;

  const [mode, setMode] = useState<AgendaMode>("day");
  const [selectedDate, setSelectedDate] = useState<string>(() => toDateKey(new Date()));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [assignTarget, setAssignTarget] = useState<Reservation | null>(null);
  const [assignee, setAssignee] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  // Owner visit notes (C3): the visit being annotated and its draft text.
  const [noteTarget, setNoteTarget] = useState<Reservation | null>(null);
  const [noteText, setNoteText] = useState("");

  const { toast } = useToast();
  const updateStatus = useUpdateReservationStatus();
  const reviewProof = useReviewProof();
  const assignPersonnel = useAssignPersonnel();

  const range = useMemo(() => {
    if (mode === "day") return { from: selectedDate, to: selectedDate };
    const from = startOfWeek(selectedDate);
    return { from, to: addDays(from, 6) };
  }, [mode, selectedDate]);

  const reservationsQuery = useCenterReservations(centerId, range.from, range.to);
  const personnelQuery = useCenterPersonnel(centerId);
  // The owner's OWN notes over the visible range (claim-scoped by the API).
  const notesQuery = useVisitNotes(range.from, range.to);
  const upsertNote = useUpsertVisitNote();
  const deleteNote = useDeleteVisitNote();

  /** reservationId → the owner's note body, for the visible range. */
  const notesByReservation = useMemo(() => {
    const map = new Map<number, string>();
    for (const note of notesQuery.data ?? []) map.set(note.reservationId, note.body);
    return map;
  }, [notesQuery.data]);

  const openNote = (reservation: Reservation) => {
    setNoteTarget(reservation);
    setNoteText(notesByReservation.get(reservation.id) ?? "");
  };

  const saveNote = () => {
    if (noteTarget === null) return;
    const body = noteText.trim();
    if (body === "") return;
    upsertNote.mutate(
      { reservationId: noteTarget.id, body },
      { onSuccess: () => setNoteTarget(null) },
    );
  };

  const clearNote = () => {
    if (noteTarget === null) return;
    deleteNote.mutate(noteTarget.id, { onSuccess: () => setNoteTarget(null) });
  };
  const errorMessage = useErrorMessage(reservationsQuery.error, "web.errors.agenda_fetch");

  const sections = useMemo<Section[]>(() => {
    const reservations = reservationsQuery.data ?? [];
    const filtered = reservations.filter(
      (reservation) => statusFilter === "ALL" || reservation.status === statusFilter,
    );

    if (mode === "day") {
      return SECTION_ORDER.map((section) => ({
        key: section,
        title: t(`web.app.agenda.section_${section}`),
        items: filtered
          .filter((reservation) => timeSection(reservation.startTime) === section)
          .sort(byStartTime),
      })).filter((section) => section.items.length > 0);
    }

    const byDay = new Map<string, Reservation[]>();
    for (const reservation of filtered) {
      const key = dateKeyFromApi(reservation.date);
      const bucket = byDay.get(key) ?? [];
      bucket.push(reservation);
      byDay.set(key, bucket);
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, items]) => ({
        key,
        title: formatDate(key, language),
        items: [...items].sort(byStartTime),
      }));
  }, [reservationsQuery.data, statusFilter, mode, t, language]);

  const shift = (direction: 1 | -1) =>
    setSelectedDate((current) => addDays(current, mode === "week" ? direction * 7 : direction));

  const handleStatusAction = async (reservationId: number, status: string) => {
    try {
      await updateStatus.mutateAsync({ reservationId, status });
      toast(t("web.app.agenda.status_success"), { variant: "success" });
    } catch (error) {
      toast(t(toErrorKey(error, "web.errors.agenda_status")), { variant: "error" });
    }
  };

  const handleReviewProof = async (reservationId: number, approve: boolean) => {
    try {
      await reviewProof.mutateAsync({ reservationId, approve });
      toast(t(approve ? "web.app.agenda.proof.approved" : "web.app.agenda.proof.rejected"), {
        variant: "success",
      });
    } catch (error) {
      toast(t(toErrorKey(error, "web.errors.agenda_proof")), { variant: "error" });
    }
  };

  const closeAssign = () => {
    setAssignTarget(null);
    setAssignee("");
  };

  const handleAssign = async () => {
    if (!assignTarget || !assignee) return;
    try {
      await assignPersonnel.mutateAsync({
        reservationId: assignTarget.id,
        personnelId: Number(assignee),
      });
      toast(t("web.app.agenda.assign.success"), { variant: "success" });
      closeAssign();
    } catch (error) {
      toast(t(toErrorKey(error, "web.errors.agenda_assign")), { variant: "error" });
    }
  };

  const assignOptions = (personnelQuery.data ?? []).filter(
    (person) => person.id !== assignTarget?.personnelId,
  );

  const mutationBusy =
    updateStatus.isPending || reviewProof.isPending || assignPersonnel.isPending;

  if (centerId <= 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("web.app.agenda.error_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-muted">{t("web.app.agenda.no_center")}</p>
        </CardContent>
      </Card>
    );
  }

  if (reservationsQuery.isError) {
    return (
      <Card role="alert">
        <CardHeader>
          <CardTitle>{t("web.app.agenda.error_title")}</CardTitle>
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
    );
  }

  const total = reservationsQuery.data?.length ?? 0;
  const emptyKey =
    statusFilter !== "ALL"
      ? "web.app.agenda.empty_filter"
      : mode === "week"
        ? "web.app.agenda.empty_week"
        : "web.app.agenda.empty_day";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="ytv-display text-3xl font-bold text-text">{t("web.app.agenda.title")}</h2>
          <p className="text-sm text-text-secondary">
            {t("web.app.agenda.total", { count: total })}
          </p>
        </div>

        <div className="flex gap-2" role="group" aria-label={t("web.app.agenda.mode_label")}>
          {(["day", "week"] as const).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={mode === value ? "primary" : "outline"}
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
            >
              {t(`web.app.agenda.mode_${value}`)}
            </Button>
          ))}
          <Button size="sm" variant="secondary" onClick={() => setScanOpen(true)}>
            {t("web.app.agenda.scan_checkin")}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            aria-label={t(mode === "week" ? "web.app.agenda.prev_week" : "web.app.agenda.prev_day")}
            onClick={() => shift(-1)}
          >
            <span aria-hidden="true">‹</span>
          </Button>
          <span className="text-sm font-semibold text-text">
            {mode === "day"
              ? formatDate(selectedDate, language)
              : t("web.app.agenda.week_range", {
                  from: formatDate(range.from, language),
                  to: formatDate(range.to, language),
                })}
          </span>
          <Button
            size="sm"
            variant="outline"
            aria-label={t(mode === "week" ? "web.app.agenda.next_week" : "web.app.agenda.next_day")}
            onClick={() => shift(1)}
          >
            <span aria-hidden="true">›</span>
          </Button>
          {!isToday(selectedDate) ? (
            <Button size="sm" variant="secondary" onClick={() => setSelectedDate(toDateKey(new Date()))}>
              {t("web.app.agenda.go_today")}
            </Button>
          ) : null}
        </div>

        <div className="w-full sm:w-56">
          <Select
            label={t("web.app.agenda.filter.label")}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          >
            {STATUS_FILTERS.map((filter) => (
              <option key={filter} value={filter}>
                {filter === "ALL"
                  ? t("web.app.agenda.filter.all")
                  : t(statusLabelKey(filter))}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {reservationsQuery.isPending ? (
        <div
          role="status"
          aria-live="polite"
          aria-label={t("common.loading")}
          className="flex flex-col gap-3"
        >
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      ) : sections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-8 text-center">
            <p className="text-base font-semibold text-text">{t("web.app.agenda.empty_title")}</p>
            <p className="text-sm text-text-muted">{t(emptyKey)}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {sections.map((section) => {
            const headingId = `agenda-section-${section.key}`;
            return (
              <section key={section.key} aria-labelledby={headingId} className="flex flex-col gap-3">
                <h3 id={headingId} className="text-lg font-semibold text-text">
                  {section.title}
                </h3>
                <ul className="flex flex-col gap-3">
                  {section.items.map((reservation, itemIndex) => (
                    <ReservationRow
                      key={reservation.id}
                      reservation={reservation}
                      revealIndex={itemIndex}
                      language={language}
                      onStatusAction={(id, status) => void handleStatusAction(id, status)}
                      onReviewProof={(id, approve) => void handleReviewProof(id, approve)}
                      onReassign={setAssignTarget}
                      note={notesByReservation.get(reservation.id)}
                      onEditNote={openNote}
                      busy={mutationBusy}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <Modal
        open={assignTarget !== null}
        onClose={closeAssign}
        closeLabel={t("common.close")}
        title={t("web.app.agenda.assign.title")}
        footer={
          <>
            <Button variant="outline" onClick={closeAssign}>
              {t("web.app.agenda.assign.cancel")}
            </Button>
            <Button
              onClick={() => void handleAssign()}
              loading={assignPersonnel.isPending}
              disabled={!assignee}
            >
              {t("web.app.agenda.assign.submit")}
            </Button>
          </>
        }
      >
        {assignOptions.length === 0 ? (
          <p className="text-sm text-text-muted">{t("web.app.agenda.assign.no_options")}</p>
        ) : (
          <Select
            label={t("web.app.agenda.assign.label")}
            value={assignee}
            onChange={(event) => setAssignee(event.target.value)}
          >
            <option value="">{t("web.app.agenda.assign.placeholder")}</option>
            {assignOptions.map((person) => (
              <option key={person.id} value={person.id}>
                {`${person.firstName} ${person.lastName}`.trim()}
              </option>
            ))}
          </Select>
        )}
      </Modal>

      <Modal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        closeLabel={t("common.close")}
        title={t("web.app.agenda.scan_title")}
      >
        <QrCheckInPanel />
      </Modal>

      <Modal
        open={noteTarget !== null}
        onClose={() => setNoteTarget(null)}
        closeLabel={t("common.close")}
        title={t("web.visit_notes.title")}
        footer={
          <>
            {noteTarget !== null && notesByReservation.has(noteTarget.id) ? (
              <Button variant="outline" loading={deleteNote.isPending} onClick={clearNote}>
                {t("common.delete")}
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setNoteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button loading={upsertNote.isPending} disabled={noteText.trim() === ""} onClick={saveNote}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        {noteTarget !== null ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-text-muted">
              {formatDate(dateKeyFromApi(noteTarget.date), language)} · {formatTime(noteTarget.startTime)}
            </p>
            <Textarea
              label={t("web.visit_notes.label")}
              value={noteText}
              maxLength={2000}
              rows={4}
              onChange={(event) => setNoteText(event.target.value)}
            />
            {upsertNote.errorKey ? (
              <p role="alert" className="text-sm text-danger">{t(upsertNote.errorKey)}</p>
            ) : null}
            {deleteNote.errorKey ? (
              <p role="alert" className="text-sm text-danger">{t(deleteNote.errorKey)}</p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
