import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ReservationStatus } from "yotuvia-core";

import { StaffAppointmentCard } from "@/presentation/components/staff";
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton, useToast } from "@/presentation/components/ui";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { useNowTick } from "@/presentation/hooks/use-now-tick";
import { useStaffAgenda, useUpdateStaffReservationStatus } from "@/presentation/hooks/use-staff";
import { addDays, isToday, timeSection, toDateKey } from "@/presentation/lib/dates";
import type { TimeSection } from "@/presentation/lib/dates";
import { toErrorKey, useErrorMessage } from "@/presentation/lib/errors";
import { formatDate, formatTime } from "@/presentation/lib/format";

const SECTION_ORDER: readonly TimeSection[] = ["morning", "afternoon", "evening"];

function byStartTime(a: { startTime: string }, b: { startTime: string }): number {
  return a.startTime.localeCompare(b.startTime);
}

/**
 * The professional's own agenda.
 *
 * DATA SHAPE: `GET /reservation/me` is claim-scoped (the JWT derives the staff
 * member) and unpaginated, so the page requests ONE day at a time
 * (`from === to`) and groups the result by time of day. The `date` field arrives
 * as a full ISO timestamp, but since the requested range is a single day the row
 * is already that day's.
 *
 * ACTIONS: only the transitions the backend accepts for a staff member
 * (`PENDING -> CONFIRMED|CANCELLED`, `CONFIRMED -> COMPLETED|CANCELLED`). A
 * successful transition invalidates the `staff` domain, which refetches the day.
 */
export function StaffAgendaPage() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t("staff.agenda.meta_title"));

  const language = i18n.resolvedLanguage ?? i18n.language;
  const [selectedDate, setSelectedDate] = useState<string>(() => toDateKey(new Date()));
  const { toast } = useToast();

  const agendaQuery = useStaffAgenda({ from: selectedDate, to: selectedDate });
  const updateStatus = useUpdateStaffReservationStatus();
  const errorMessage = useErrorMessage(agendaQuery.error, "web.errors.staff_agenda_fetch");
  // One shared tick keeps the "next appointment" strip fresh while the day runs.
  const now = useNowTick();

  /**
   * The next appointment still ahead of the clock, ONLY when viewing today.
   * Cancelled/completed rows are excluded: a finished or cancelled visit is not
   * "next".
   */
  const nextAppointment = useMemo(() => {
    if (!isToday(selectedDate)) return null;
    const currentTime = new Date(now).toTimeString().slice(0, 5);
    return (
      (agendaQuery.data ?? [])
        .filter(
          (reservation) =>
            (reservation.status === "PENDING" || reservation.status === "CONFIRMED") &&
            reservation.startTime.slice(0, 5) >= currentTime,
        )
        .sort(byStartTime)[0] ?? null
    );
  }, [agendaQuery.data, selectedDate, now]);

  const sections = useMemo(() => {
    const reservations = agendaQuery.data ?? [];
    return SECTION_ORDER.map((section) => ({
      key: section,
      title: t(`staff.agenda.section_${section}`),
      items: reservations
        .filter((reservation) => timeSection(reservation.startTime) === section)
        .sort(byStartTime),
    })).filter((section) => section.items.length > 0);
  }, [agendaQuery.data, t]);

  const shift = (direction: 1 | -1) =>
    setSelectedDate((current) => addDays(current, direction));

  const handleStatusAction = async (reservationId: number, status: ReservationStatus) => {
    try {
      await updateStatus.mutateAsync({ reservationId, status });
      toast(t("staff.agenda.status_success"), { variant: "success" });
    } catch (error) {
      toast(t(toErrorKey(error, "web.errors.staff_agenda_status")), { variant: "error" });
    }
  };

  const total = agendaQuery.data?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-text">{t("staff.agenda.title")}</h2>
        <p className="text-sm text-text-secondary">{t("staff.agenda.total", { count: total })}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          aria-label={t("staff.agenda.prev_day")}
          onClick={() => shift(-1)}
        >
          <span aria-hidden="true">‹</span>
        </Button>
        <span className="text-sm font-semibold text-text">
          {formatDate(selectedDate, language)}
        </span>
        <Button
          size="sm"
          variant="outline"
          aria-label={t("staff.agenda.next_day")}
          onClick={() => shift(1)}
        >
          <span aria-hidden="true">›</span>
        </Button>
        {!isToday(selectedDate) ? (
          <Button size="sm" variant="secondary" onClick={() => setSelectedDate(toDateKey(new Date()))}>
            {t("staff.agenda.go_today")}
          </Button>
        ) : null}
      </div>

      {nextAppointment !== null && !agendaQuery.isPending && !agendaQuery.isError ? (
        <p className="text-sm font-medium text-accent">
          {t("staff.agenda.next_line", {
            time: formatTime(nextAppointment.startTime),
            name:
              nextAppointment.client?.firstName || nextAppointment.client?.lastName
                ? `${nextAppointment.client?.firstName ?? ""} ${nextAppointment.client?.lastName ?? ""}`.trim()
                : nextAppointment.clientName?.trim() ||
                  t("staff.agenda.client_fallback", { id: nextAppointment.clientId }),
          })}
        </p>
      ) : null}

      {agendaQuery.isPending ? (
        <div
          role="status"
          aria-live="polite"
          aria-label={t("common.loading")}
          className="flex flex-col gap-3"
        >
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-32 w-full" />
          ))}
        </div>
      ) : agendaQuery.isError ? (
        <Card role="alert">
          <CardHeader>
            <CardTitle>{t("staff.agenda.error_title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-text-muted">{errorMessage}</p>
            <Button
              variant="outline"
              className="self-start"
              onClick={() => void agendaQuery.refetch()}
            >
              {t("common.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : sections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-8 text-center">
            <p className="text-base font-semibold text-text">{t("staff.agenda.empty_title")}</p>
            <p className="text-sm text-text-muted">{t("staff.agenda.empty_day")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {sections.map((section) => {
            const headingId = `staff-agenda-section-${section.key}`;
            return (
              <section key={section.key} aria-labelledby={headingId} className="flex flex-col gap-3">
                <h3 id={headingId} className="text-lg font-semibold text-text">
                  {section.title}
                </h3>
                <ul className="flex flex-col gap-3">
                  {section.items.map((reservation) => (
                    <StaffAppointmentCard
                      key={reservation.id}
                      reservation={reservation}
                      language={language}
                      busy={updateStatus.isPending}
                      onStatusAction={(id, status) => void handleStatusAction(id, status)}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
