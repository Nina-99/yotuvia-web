import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { VerifyQrResult } from "yotuvia-core";

import { QrScanner } from "@/presentation/components/staff";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/presentation/components/ui";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { useVerifyQr } from "@/presentation/hooks/use-staff";
import { useAuthSession } from "@/presentation/hooks/use-auth-session";
import { getErrorStatus } from "@/presentation/lib/errors";
import { formatCurrency, formatTime } from "@/presentation/lib/format";

/** Distinct failure states the verify endpoint can produce. */
type ScanFailure = "invalid" | "expired" | "cancelled" | "generic";

const FAILURE_KEY: Readonly<Record<ScanFailure, string>> = {
  invalid: "staff.scan.error_invalid",
  expired: "staff.scan.error_expired",
  cancelled: "staff.scan.error_cancelled",
  generic: "staff.scan.error_verify",
};

function failureFromError(error: unknown): ScanFailure {
  switch (getErrorStatus(error)) {
    case 400:
      return "expired";
    case 404:
      return "invalid";
    case 409:
      return "cancelled";
    default:
      return "generic";
  }
}

/**
 * QR check-in for a client's reservation credential (web replacement for the
 * mobile camera screen).
 *
 * FLOW:
 *   1. `QrScanner` decodes the credential and STOPS the stream (a check-in
 *      credential must never be scanned twice by accident);
 *   2. the value goes to `verifyQrUseCase` (`GET /reservation/verify-qr`);
 *   3. success renders the reservation details; a re-scan of an already
 *      completed credential renders the distinct "already completed" state; a
 *      400/404/409 renders the matching failure state;
 *   4. "Scan another" re-arms the scanner WITHOUT a page reload, which restarts
 *      the camera; leaving the page unmounts `QrScanner`, whose cleanup stops
 *      every track (no leaked `MediaStream`).
 */
export function StaffScanPage() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t("staff.scan.meta_title"));

  const language = i18n.resolvedLanguage ?? i18n.language;
  const { user } = useAuthSession();
  const verifyMutation = useVerifyQr();

  const [scanning, setScanning] = useState(true);
  const [scanKey, setScanKey] = useState(0);
  const [result, setResult] = useState<VerifyQrResult | null>(null);
  const [failure, setFailure] = useState<ScanFailure | null>(null);

  const staffId = Number(user?.id ?? 0);

  const handleDecoded = async (token: string) => {
    // Stop the stream as soon as a code is read: no double scans, no camera
    // left running while the network request is in flight.
    setScanning(false);
    setResult(null);
    setFailure(null);
    try {
      const verified = await verifyMutation.mutateAsync(token);
      setResult(verified);
    } catch (error) {
      setFailure(failureFromError(error));
    }
  };

  const scanAgain = () => {
    setResult(null);
    setFailure(null);
    setScanning(true);
    setScanKey((value) => value + 1);
  };

  const reservation = result?.reservation;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-text">{t("staff.scan.title")}</h2>
        <p className="text-sm text-text-secondary">{t("staff.scan.meta_hint")}</p>
      </div>

      {staffId <= 0 ? (
        <Card role="alert">
          <CardHeader>
            <CardTitle>{t("staff.scan.error_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-text-muted">{t("staff.scan.no_staff")}</p>
          </CardContent>
        </Card>
      ) : result !== null && reservation !== undefined ? (
        <Card role="status" aria-live="polite">
          <CardHeader className="flex flex-row flex-wrap items-center gap-2">
            <CardTitle>
              {t(result.alreadyCompleted ? "staff.scan.already_completed" : "staff.scan.check_in_success")}
            </CardTitle>
            <Badge variant={result.alreadyCompleted ? "warning" : "success"}>
              {t(result.alreadyCompleted ? "staff.scan.status_repeat" : "staff.scan.status_ok")}
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <dl className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-sm text-text-muted">{t("staff.scan.client")}</dt>
                <dd className="text-sm font-medium text-text">
                  {reservation.clientName?.trim() || t("staff.scan.client_fallback")}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-sm text-text-muted">{t("staff.scan.time")}</dt>
                <dd className="text-sm font-medium text-text">
                  {formatTime(reservation.startTime)} – {formatTime(reservation.endTime)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-sm text-text-muted">{t("staff.scan.service")}</dt>
                <dd className="text-right text-sm font-medium text-text">
                  {reservation.services.map((service) => service.serviceName).join(", ")}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-sm text-text-muted">{t("staff.scan.price")}</dt>
                <dd className="text-sm font-medium text-text">
                  {formatCurrency(reservation.totalPrice, language, reservation.currency ?? "USD")}
                </dd>
              </div>
            </dl>
            <Button className="self-start" onClick={scanAgain}>
              {t("staff.scan.scan_again")}
            </Button>
          </CardContent>
        </Card>
      ) : failure !== null ? (
        <Card role="alert">
          <CardHeader>
            <CardTitle>{t("staff.scan.error_title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-text-muted">{t(FAILURE_KEY[failure])}</p>
            <Button variant="outline" className="self-start" onClick={scanAgain}>
              {t("staff.scan.scan_again")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          <QrScanner onDecoded={(value) => void handleDecoded(value)} active={scanning} scanKey={scanKey} />
          {verifyMutation.isPending ? (
            <p role="status" aria-live="polite" className="text-sm text-text-muted">
              {t("staff.scan.verifying")}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
