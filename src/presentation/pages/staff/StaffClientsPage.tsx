import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { deriveStaffClients } from "yotuvia-core";
import type { Reservation, StaffClientSummary } from "yotuvia-core";

import {
  Button,
  Card,
  CardContent,
  EmptyState,
  Input,
  Modal,
  Skeleton,
  Textarea,
} from "@/presentation/components/ui";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { useStaffAgenda } from "@/presentation/hooks/use-staff";
import {
  useDeleteVisitNote,
  useVisitNotes,
  useUpsertVisitNote,
} from "@/presentation/hooks/use-visit-notes";
import { addDays, dateKeyFromApi, toDateKey } from "@/presentation/lib/dates";
import { useErrorMessage } from "@/presentation/lib/errors";
import { formatCurrency, formatDate, formatNumber, formatTime } from "@/presentation/lib/format";

/**
 * Served-window size, mirroring the mobile staff clients screen: the backend
 * can satisfy a 90-day history in one unpaginated `/reservation/me` call.
 */
const SERVED_WINDOW_DAYS = 90;

/**
 * The clients the professional has SERVED.
 *
 * SOURCE: the same `GET /reservation/me` agenda, over the last 90 days. The
 * summary is derived client-side by the shared `deriveStaffClients` (completed
 * visits only), so no dedicated endpoint exists or is needed.
 */
export function StaffClientsPage() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t("staff.clients.title"));

  const language = i18n.resolvedLanguage ?? i18n.language;
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<StaffClientSummary | null>(null);
  // Visit-note editor: the reservation being annotated and its draft text.
  const [noteTarget, setNoteTarget] = useState<Reservation | null>(null);
  const [noteText, setNoteText] = useState("");

  const today = toDateKey(new Date());
  const from = addDays(today, -SERVED_WINDOW_DAYS);
  const agendaQuery = useStaffAgenda({ from, to: today });
  const notesQuery = useVisitNotes(from, today);
  const upsertNote = useUpsertVisitNote();
  const deleteNote = useDeleteVisitNote();

  const errorMessage = useErrorMessage(agendaQuery.error, "web.errors.staff_clients_fetch");
  const notesError = useErrorMessage(notesQuery.error, "web.errors.staff_clients_fetch");

  const notesByReservation = useMemo(() => {
    const map = new Map<number, string>();
    for (const note of notesQuery.data ?? []) map.set(note.reservationId, note.body);
    return map;
  }, [notesQuery.data]);

  const clients = useMemo(
    () => (agendaQuery.data ? deriveStaffClients(agendaQuery.data, today) : []),
    [agendaQuery.data, today],
  );

  const filtered = useMemo(() => {
    const query = term.trim().toLowerCase();
    return query === "" ? clients : clients.filter((c) => c.name.toLowerCase().includes(query));
  }, [clients, term]);

  const selectedVisits = useMemo(
    () =>
      selected
        ? (agendaQuery.data ?? [])
            .filter((r) => r.clientId === selected.clientId && r.status === "COMPLETED")
            .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
        : [],
    [agendaQuery.data, selected],
  );

  const displayName = (client: StaffClientSummary) =>
    client.name || t("staff.agenda.client_fallback", { id: client.clientId });

  const openNote = (visit: Reservation) => {
    setNoteTarget(visit);
    setNoteText(notesByReservation.get(visit.id) ?? "");
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

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-bold text-text">{t("staff.clients.title")}</h2>

      <div className="sm:max-w-xs">
        <Input
          label={t("staff.clients.title")}
          placeholder={t("staff.clients.search_placeholder")}
          value={term}
          onChange={(event) => setTerm(event.target.value)}
        />
      </div>

      {agendaQuery.isPending ? (
        <div role="status" aria-live="polite" aria-label={t("common.loading")} className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : agendaQuery.isError ? (
        <Card role="alert">
          <CardContent className="flex flex-col gap-4 p-4">
            <p className="text-sm text-text-muted">{errorMessage}</p>
            <Button variant="outline" className="self-start" onClick={() => void agendaQuery.refetch()}>
              {t("common.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-8 text-center">
            <EmptyState title={t("staff.clients.empty")} body={t("staff.clients.empty_sub")} />
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((client) => (
            <li key={client.clientId}>
              <button
                type="button"
                onClick={() => setSelected(client)}
                className="flex w-full flex-col gap-1 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="text-sm font-semibold text-text">{displayName(client)}</span>
                <span className="flex flex-wrap gap-x-3 text-xs text-text-muted">
                  <span>{t("staff.clients.visits", { count: client.visitCount })}</span>
                  <span>{t("staff.clients.last_visit", { date: formatDate(client.lastDate, language) })}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        closeLabel={t("common.close")}
        title={t("staff.clients.detail.title")}
      >
        {selected !== null ? (
          <div className="flex flex-col gap-4">
            <p className="text-base font-semibold text-text">{displayName(selected)}</p>

            <dl className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
                <dt className="text-xs text-text-muted">{t("staff.clients.metrics.visits")}</dt>
                <dd className="text-lg font-bold text-text">{formatNumber(selected.visitCount, language)}</dd>
              </div>
              <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
                <dt className="text-xs text-text-muted">{t("staff.clients.metrics.spent")}</dt>
                <dd className="text-lg font-bold text-text">{formatCurrency(selected.totalSpent, language)}</dd>
              </div>
              <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
                <dt className="text-xs text-text-muted">{t("staff.clients.metrics.last_visit")}</dt>
                <dd className="text-lg font-bold text-text">{formatDate(selected.lastDate, language)}</dd>
              </div>
            </dl>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-text">{t("staff.clients.metrics_title")}</p>
              {notesQuery.isError ? (
                <p role="alert" className="text-xs text-text-muted">{notesError}</p>
              ) : null}
              {selectedVisits.length === 0 ? (
                <p className="text-sm text-text-muted">{t("staff.clients.no_reservations")}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {selectedVisits.map((visit) => {
                    const note = notesByReservation.get(visit.id);
                    return (
                      <li
                        key={visit.id}
                        className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-text">
                            {formatDate(dateKeyFromApi(visit.date), language)} · {formatTime(visit.startTime)}
                          </span>
                          <span className="text-xs text-text-muted">
                            {formatCurrency(visit.totalPrice, language, visit.currency)}
                          </span>
                        </div>
                        {note ? (
                          <p className="whitespace-pre-wrap rounded-md bg-card2 p-2 text-xs text-text">
                            {note}
                          </p>
                        ) : null}
                        <Button variant="ghost" size="sm" className="self-start" onClick={() => openNote(visit)}>
                          {note ? t("web.visit_notes.edit") : t("web.visit_notes.add")}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={noteTarget !== null}
        onClose={() => setNoteTarget(null)}
        closeLabel={t("common.close")}
        title={t("web.visit_notes.title")}
        footer={
          <>
            {notesByReservation.has(noteTarget?.id ?? -1) ? (
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
