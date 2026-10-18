import { useTranslation } from "react-i18next";

import { QrCheckInPanel } from "@/presentation/components/staff";
import { Card, CardContent, CardHeader, CardTitle } from "@/presentation/components/ui";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { useAuthSession } from "@/presentation/hooks/use-auth-session";

/**
 * QR check-in page for a professional (`/app/staff/scan`).
 *
 * The scan → verify → result flow lives in the shared `QrCheckInPanel` (also
 * used by the owner's agenda). This page only adds the title and the
 * staff-account guard.
 */
export function StaffScanPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("staff.scan.meta_title"));

  const { user } = useAuthSession();
  const staffId = Number(user?.id ?? 0);

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
      ) : (
        <QrCheckInPanel />
      )}
    </div>
  );
}
