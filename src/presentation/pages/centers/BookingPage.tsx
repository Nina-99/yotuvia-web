import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";

import { FormAlert } from "@/presentation/components/form";
import {
  Button,
  Card,
  CardContent,
  Input,
  Modal,
  Select,
  Skeleton,
  buttonClasses,
} from "@/presentation/components/ui";
import { useBeautyCenter } from "@/presentation/hooks/use-beauty-centers";
import { useAvailability, useCreateClientReservation } from "@/presentation/hooks/use-booking";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { useCenterPersonnel } from "@/presentation/hooks/use-personnel";
import { useClientServices } from "@/presentation/hooks/use-services";
import { dateKeyFromApi, toDateKey } from "@/presentation/lib/dates";
import { useErrorMessage } from "@/presentation/lib/errors";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatRating,
  formatTime,
} from "@/presentation/lib/format";
import { ROUTES, centerDetailPath } from "@/presentation/lib/routes";
import {
  BOOKING_DATE_PATTERN,
  bookingDraftSchema,
  bookingServicesSchema,
  bookingSlotSchema,
} from "@/presentation/schemas/booking.schemas";

/** How long the success panel stays before the reservations list replaces it. */
export const BOOKING_SUCCESS_REDIRECT_MS = 1500;

/** Wizard steps, in order. */
type BookingStep = "services" | "schedule" | "confirm";

const STEP_ORDER: readonly BookingStep[] = ["services", "schedule", "confirm"];

const STEP_LABEL_KEYS: Readonly<Record<BookingStep, string>> = {
  services: "client.reservation.step_services",
  schedule: "client.reservation.step_schedule",
  confirm: "client.reservation.step_confirm",
};

interface SlotOption {
  startTime: string;
  duration: number;
}

/**
 * CLIENT-only booking flow (`/centers/:centerId/book`).
 *
 * Walks services -> professional + day + slot -> review, then writes through
 * `createReservationUseCase` (`POST /reservation/`, JWT + `client` role). The
 * server resolves the client from the JWT claim (`req.ClientID = clientID` in
 * the controller), so the web never sends `client_id`.
 *
 * WHAT THE API REALLY ALLOWS, and what this page therefore does:
 * - Availability comes from `searchAvailabilityUseCase`
 *   (`GET /availability/search`, public) scoped to ONE day (`from === to`).
 *   `serviceIds` is the documented path for concrete catalog services: the
 *   endpoint sizes the booking window from their durations.
 * - Personnel is OPTIONAL (`personnel_id`). "Any" omits the field and the server
 *   assigns a professional. The web CANNOT pre-filter staff by capability
 *   (`getPersonnelUseCase.execute(centerId)` takes no service ids), so a
 *   professional who cannot perform the whole bundle is rejected server-side
 *   with a 400 that is surfaced through the shared error mapping.
 * - There is NO online payment step: the platform's only payment medium is
 *   Yotuvia tokens and there is no payment gateway. A deposit hold the center may
 *   apply is decided server-side — `POST /reservation/` answers
 *   `201 {message}` and `ApiReservationRepository.create` returns `void` — so the
 *   outcome is shown in the reservations list, never faked here.
 */
export function BookingPage() {
  const { t, i18n } = useTranslation();
  const { centerId: rawCenterId } = useParams<{ centerId: string }>();
  const centerId = Number(rawCenterId ?? 0);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();

  const centerQuery = useBeautyCenter(centerId, language);
  const servicesQuery = useClientServices(centerId);
  const personnelQuery = useCenterPersonnel(centerId);

  const [step, setStep] = useState<BookingStep>("services");
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
  const [personnelId, setPersonnelId] = useState<number | null>(null);
  const [date, setDate] = useState(() => toDateKey(new Date()));
  const [startTime, setStartTime] = useState<string | null>(null);
  const [stepErrorKey, setStepErrorKey] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  // Earn/redeem choice (confirm step): true = earn stamps + auto-redeem
  // (legacy behaviour, omitted from the payload); false = skip loyalty.
  const [applyLoyalty, setApplyLoyalty] = useState(true);

  const createReservation = useCreateClientReservation();

  const availabilityQuery = useAvailability(
    step === "services"
      ? null
      : {
          centerId,
          serviceIds: selectedServiceIds,
          date,
          personnelId: personnelId ?? undefined,
        },
  );

  const center = centerQuery.data;
  const centerName = center?.name.trim() ? center.name : t("web.home.search.unknown_center");
  useDocumentTitle(t("web.centers.booking.meta_title"));

  const services = useMemo(() => servicesQuery.data ?? [], [servicesQuery.data]);
  const selectedServices = useMemo(
    () => services.filter((service) => selectedServiceIds.includes(service.id)),
    [services, selectedServiceIds],
  );
  const totalDuration = selectedServices.reduce((total, service) => total + service.duration, 0);
  const totalPrice = selectedServices.reduce((total, service) => total + service.price, 0);

  /** Distinct start times for the chosen day, in chronological order. */
  const slots = useMemo(() => {
    const rows = availabilityQuery.data ?? [];
    const byTime = new Map<string, number>();
    for (const row of rows) {
      // `from === to === date`, so this is a guard against a timestamp-shaped
      // date rather than a real re-bucketing.
      if (dateKeyFromApi(row.date) !== date) continue;
      if (!byTime.has(row.startTime)) byTime.set(row.startTime, row.duration);
    }
    return [...byTime.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([slotTime, duration]): SlotOption => ({ startTime: slotTime, duration }));
  }, [availabilityQuery.data, date]);

  const todayKey = toDateKey(new Date());
  const availabilityError = useErrorMessage(
    availabilityQuery.error,
    "web.errors.client_availability_fetch",
  );
  const servicesError = useErrorMessage(
    servicesQuery.error,
    "web.errors.client_center_services_fetch",
  );

  const personnelName = useMemo(() => {
    if (personnelId === null) return null;
    const member = (personnelQuery.data ?? []).find((person) => person.id === personnelId);
    return member ? `${member.firstName} ${member.lastName}`.trim() : null;
  }, [personnelId, personnelQuery.data]);

  // Redirect once the booking is confirmed: the reservations list is where the
  // client manages, cancels and shows the QR of the new appointment.
  useEffect(() => {
    if (!confirmed) return;
    const timer = setTimeout(
      () => navigate(ROUTES.client.reservations, { replace: true }),
      BOOKING_SUCCESS_REDIRECT_MS,
    );
    return () => clearTimeout(timer);
  }, [confirmed, navigate]);

  const toggleService = (serviceId: number) => {
    setStepErrorKey(null);
    // A different bundle invalidates the chosen slot: its duration may no
    // longer fit.
    setStartTime(null);
    setSelectedServiceIds((previous) =>
      previous.includes(serviceId)
        ? previous.filter((id) => id !== serviceId)
        : [...previous, serviceId],
    );
  };

  const handlePersonnelChange = (value: string) => {
    setStepErrorKey(null);
    setStartTime(null);
    setPersonnelId(value === "" ? null : Number(value));
  };

  const handleDateChange = (value: string) => {
    setStepErrorKey(null);
    setStartTime(null);
    setDate(value);
  };

  const goToSchedule = () => {
    const parsed = bookingServicesSchema.safeParse({ serviceIds: selectedServiceIds });
    if (!parsed.success) {
      setStepErrorKey(parsed.error.issues[0]?.message ?? "web.errors.unknown");
      return;
    }
    setStepErrorKey(null);
    setStep("schedule");
  };

  const goToConfirm = () => {
    if (startTime === null) {
      setStepErrorKey("web.centers.booking.select_slot");
      return;
    }
    const parsed = bookingSlotSchema.safeParse({ date, startTime });
    if (!parsed.success) {
      setStepErrorKey(parsed.error.issues[0]?.message ?? "web.errors.unknown");
      return;
    }
    setStepErrorKey(null);
    setStep("confirm");
  };

  const submitBooking = async () => {
    const parsed = bookingDraftSchema.safeParse({
      serviceIds: selectedServiceIds,
      date,
      startTime: startTime ?? "",
      personnelId,
    });
    if (!parsed.success) {
      setStepErrorKey(parsed.error.issues[0]?.message ?? "web.errors.unknown");
      return;
    }

    try {
      await createReservation.mutateAsync({
        beautyCenterId: centerId,
        services: parsed.data.serviceIds.map((serviceId) => ({ serviceId })),
        date: parsed.data.date,
        startTime: parsed.data.startTime,
        // Omitted (never `null`) when "Any": the server then picks a professional.
        personnelId: parsed.data.personnelId ?? undefined,
        // Loyalty choice: omitted when earning so legacy payloads stay
        // byte-identical — absent means auto-apply server-side.
        ...(applyLoyalty ? {} : { applyLoyalty: false as const }),
      });
      setConfirmOpen(false);
      setConfirmed(true);
    } catch {
      // `createReservation.errorKey` keeps the dialog open with the message.
    }
  };

  if (centerId <= 0) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <p className="text-sm text-text-muted">{t("web.centers.booking.no_center")}</p>
          <Link
            to={ROUTES.centers.search}
            className="self-start rounded text-sm font-semibold text-link underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t("web.centers.detail.back_to_search")}
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (centerQuery.isPending) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={t("common.loading")}
        className="flex flex-col gap-3"
      >
        <Skeleton className="h-7 w-2/3 max-w-md" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (centerQuery.isError || !center) {
    return (
      <Card role="alert">
        <CardContent className="flex flex-col items-start gap-3 p-4">
          <p className="text-sm text-text-muted">{t("web.centers.detail.error_title")}</p>
          <Button variant="outline" onClick={() => void centerQuery.refetch()}>
            {t("common.retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (confirmed) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
          <p className="text-lg font-semibold text-text">
            {t("client.reservation.success_title")}
          </p>
          <p className="text-sm text-text-muted">{t("client.reservation.success_subtitle")}</p>
          <p className="max-w-md text-xs text-text-muted">
            {t("web.centers.booking.success_deposit_note")}
          </p>
          <Link
            to={ROUTES.client.reservations}
            className={buttonClasses({ variant: "outline", size: "sm", className: "mt-2" })}
          >
            {t("web.app.nav.client_reservations")}
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          to={centerDetailPath(center.id)}
          className="self-start rounded text-sm font-semibold text-link underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {t("web.centers.booking.back_to_center")}
        </Link>
        <h2 className="text-2xl font-bold text-text">
          {t("web.centers.booking.title", { center: centerName })}
        </h2>
      </div>

      <ol
        className="flex flex-wrap gap-2 text-xs font-medium"
        aria-label={t("web.centers.booking.steps_label")}
      >
        {STEP_ORDER.map((candidate, index) => (
          <li
            key={candidate}
            aria-current={candidate === step ? "step" : undefined}
            className={
              candidate === step
                ? "rounded-full border border-accent px-3 py-1 text-text"
                : "rounded-full border border-border px-3 py-1 text-text-muted"
            }
          >
            {`${formatNumber(index + 1, language)}. ${t(STEP_LABEL_KEYS[candidate])}`}
          </li>
        ))}
      </ol>

      <FormAlert message={stepErrorKey} />

      {step === "services" ? (
        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <h3 className="text-lg font-semibold text-text">
              {t("client.reservation.step_services")}
            </h3>
            <p className="text-sm text-text-secondary">{t("web.centers.booking.services_hint")}</p>

            {servicesQuery.isPending ? (
              <div
                role="status"
                aria-live="polite"
                aria-label={t("common.loading")}
                className="flex flex-col gap-2"
              >
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : servicesQuery.isError ? (
              <div role="alert" className="flex flex-col items-start gap-3">
                <p className="text-sm text-text-muted">{servicesError}</p>
                <Button variant="outline" onClick={() => void servicesQuery.refetch()}>
                  {t("common.retry")}
                </Button>
              </div>
            ) : services.length === 0 ? (
              <p className="text-sm text-text-muted">{t("client.reservation.no_services")}</p>
            ) : (
              <fieldset className="flex flex-col gap-2">
                <legend className="sr-only">{t("client.reservation.step_services")}</legend>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {services.map((service) => (
                    <li key={service.id}>
                      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:border-text-muted has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-accent"
                          checked={selectedServiceIds.includes(service.id)}
                          onChange={() => toggleService(service.id)}
                        />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate font-medium text-text">{service.name}</span>
                          <span className="text-xs text-text-muted">
                            {formatNumber(service.duration, language)}
                            {t("client.center.min_unit")}
                            {" · "}
                            {formatCurrency(service.price, language, center.currency)}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={goToSchedule} disabled={services.length === 0}>
                {t("client.reservation.next")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "schedule" ? (
        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <h3 className="text-lg font-semibold text-text">
              {t("client.reservation.step_schedule")}
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label={t("client.reservation.select_professional")}
                helperText={t("web.centers.booking.professional_hint")}
                value={personnelId === null ? "" : String(personnelId)}
                onChange={(event) => handlePersonnelChange(event.target.value)}
              >
                <option value="">{t("client.reservation.any_professional")}</option>
                {(personnelQuery.data ?? []).map((member) => (
                  <option key={member.id} value={member.id}>
                    {`${member.firstName} ${member.lastName}`.trim()}
                  </option>
                ))}
              </Select>

              <Input
                type="date"
                label={t("client.reservation.summary_date")}
                value={date}
                min={todayKey}
                onChange={(event) => handleDateChange(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-text">{t("client.reservation.summary_time")}</p>

              {!BOOKING_DATE_PATTERN.test(date) ? (
                <p className="text-sm text-text-muted">{t("web.centers.booking.select_date")}</p>
              ) : availabilityQuery.isPending ? (
                <div
                  role="status"
                  aria-live="polite"
                  aria-label={t("common.loading")}
                  className="flex flex-wrap gap-2"
                >
                  <Skeleton className="h-9 w-20" />
                  <Skeleton className="h-9 w-20" />
                  <Skeleton className="h-9 w-20" />
                </div>
              ) : availabilityQuery.isError ? (
                <div role="alert" className="flex flex-col items-start gap-3">
                  <p className="text-sm text-text-muted">
                    {availabilityError ?? t("client.center.availability_error")}
                  </p>
                  <Button variant="outline" onClick={() => void availabilityQuery.refetch()}>
                    {t("common.retry")}
                  </Button>
                </div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-text-muted">{t("client.center.availability_none")}</p>
              ) : (
                <>
                  <p className="text-xs text-text-muted">
                    {t("client.center.availability_count", { count: slots.length })}
                  </p>
                  <ul className="flex flex-wrap gap-2">
                    {slots.map((slot) => (
                      <li key={slot.startTime}>
                        <label className="inline-flex cursor-pointer items-center text-sm">
                          <input
                            type="radio"
                            name="booking-slot"
                            className="peer sr-only"
                            value={slot.startTime}
                            checked={startTime === slot.startTime}
                            onChange={() => {
                              setStepErrorKey(null);
                              setStartTime(slot.startTime);
                            }}
                          />
                          <span className="rounded-lg border border-border bg-card px-3 py-2 text-text peer-checked:border-accent peer-checked:bg-accent/10 peer-checked:font-semibold peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
                            {formatTime(slot.startTime)}
                            <span className="ml-1 text-xs text-text-muted">
                              {formatNumber(slot.duration, language)}
                              {t("client.center.min_unit")}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setStepErrorKey(null);
                  setStep("services");
                }}
              >
                {t("client.reservation.back")}
              </Button>
              <Button onClick={goToConfirm} disabled={slots.length === 0}>
                {t("client.reservation.next")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "confirm" ? (
        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <h3 className="text-lg font-semibold text-text">
              {t("client.reservation.step_confirm")}
            </h3>

            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">{t("client.reservation.summary_center")}</dt>
                <dd className="font-medium text-text">{centerName}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">
                  {t("client.reservation.summary_professional")}
                </dt>
                <dd className="font-medium text-text">
                  {personnelName ?? t("client.reservation.any_professional")}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">{t("client.reservation.summary_date")}</dt>
                <dd className="font-medium text-text">{formatDate(date, language)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">{t("client.reservation.summary_time")}</dt>
                <dd className="font-medium text-text" dir="ltr">
                  {startTime === null ? "" : formatTime(startTime)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">{t("client.reservation.summary_duration")}</dt>
                <dd className="font-medium text-text">
                  {formatNumber(totalDuration, language)}
                  {t("client.center.min_unit")}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">{t("client.reservation.summary_total")}</dt>
                <dd className="font-medium text-text">
                  {formatCurrency(totalPrice, language, center.currency)}
                </dd>
              </div>
            </dl>

            <ul className="flex flex-col gap-1 text-sm text-text">
              {selectedServices.map((service) => (
                <li key={service.id} className="flex justify-between gap-3">
                  <span className="truncate">{service.name}</span>
                  <span className="shrink-0 text-text-muted">
                    {formatCurrency(service.price, language, center.currency)}
                  </span>
                </li>
              ))}
            </ul>

            {typeof center.averageRating === "number" && center.averageRating > 0 ? (
              <p className="text-xs text-text-muted">
                {t("web.home.search.rating_reviews", {
                  rating: formatRating(center.averageRating, language),
                  count: formatNumber(center.reviewCount ?? 0, language),
                })}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setStepErrorKey(null);
                  setStep("schedule");
                }}
              >
                {t("client.reservation.back")}
              </Button>
              <Button onClick={() => setConfirmOpen(true)}>
                {t("client.reservation.confirm")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Modal
        open={confirmOpen}
        onClose={() => {
          if (createReservation.isPending) return;
          setConfirmOpen(false);
        }}
        closeLabel={t("common.close")}
        title={t("web.centers.booking.modal_title")}
        description={t("web.centers.booking.modal_note")}
        footer={
          <>
            <Button
              variant="outline"
              disabled={createReservation.isPending}
              onClick={() => setConfirmOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button loading={createReservation.isPending} onClick={() => void submitBooking()}>
              {createReservation.isPending
                ? t("client.reservation.submitting")
                : t("client.reservation.confirm")}
            </Button>
          </>
        }
      >
        <FormAlert message={createReservation.errorKey ?? stepErrorKey} variant="error" />
        <label className="mt-3 flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={applyLoyalty}
            onChange={(event) => setApplyLoyalty(event.target.checked)}
            data-testid="loyalty-apply-toggle"
            className="h-4 w-4 accent-current"
          />
          <span className="flex flex-col">
            <span className="text-sm font-medium text-text">
              {t("client.loyalty.apply_title")}
            </span>
            <span className="text-xs text-text-muted">{t("client.loyalty.apply_hint")}</span>
          </span>
        </label>
        <p className="mt-3">
          {t("client.reservation.summary_date")}: {formatDate(date, language)}
          {" · "}
          {startTime === null ? "" : formatTime(startTime)}
        </p>
      </Modal>
    </div>
  );
}
