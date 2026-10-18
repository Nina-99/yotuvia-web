import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { Button, Card, CardContent, CardHeader, CardTitle, ConfirmDialog } from "@/presentation/components/ui";
import { useAuthSession } from "@/presentation/hooks/use-auth-session";
import { ROUTES } from "@/presentation/lib/routes";

/**
 * Account-security block for the client profile.
 *
 * Owns the one device-agnostic action web can offer: "sign out on all devices",
 * which revokes every server session including this one. Mirrors the mobile
 * `SecuritySection` behaviour (the biometric toggle is device-local and has no
 * web equivalent). The confirmation is deliberate and destructive, and a
 * failure keeps the user signed in rather than half-logged-out.
 */
export function SecuritySection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logoutEverywhere } = useAuthSession();

  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setPending(true);
    setError(null);
    try {
      await logoutEverywhere();
      navigate(ROUTES.login, { replace: true });
    } catch {
      // The revocation failed, so the local session is still valid.
      setError(t("security.logout_all_error"));
      setPending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("security.section_title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Button variant="danger" onClick={() => setOpen(true)}>
          {t("security.logout_all")}
        </Button>
      </CardContent>

      <ConfirmDialog
        open={open}
        title={t("security.logout_all_title")}
        description={t("security.logout_all_confirm")}
        confirmLabel={t("security.logout_all")}
        cancelLabel={t("common.cancel")}
        closeLabel={t("common.close")}
        loading={pending}
        error={error}
        onConfirm={() => void confirm()}
        onCancel={() => {
          setOpen(false);
          setError(null);
        }}
      />
    </Card>
  );
}
