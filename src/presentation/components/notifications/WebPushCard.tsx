import { useTranslation } from "react-i18next";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui";
import { useWebPush } from "@/presentation/hooks/use-web-push";

/**
 * Opt-in for browser push notifications (C4).
 *
 * Renders NOTHING when the browser cannot do Web Push or the server has no VAPID
 * keys — an affordance that could only fail must never be shown.
 */
export function WebPushCard() {
  const { t } = useTranslation();
  const push = useWebPush();

  if (!push.available) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("web.push_notifications.title")}</CardTitle>
        <CardDescription>{t("web.push_notifications.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {push.permission === "denied" ? (
          <p className="text-sm text-text-muted">{t("web.push_notifications.blocked")}</p>
        ) : (
          <p className="text-sm text-text-muted">
            {push.enabled
              ? t("web.push_notifications.status_on")
              : t("web.push_notifications.status_off")}
          </p>
        )}

        {push.error ? (
          <p role="alert" className="text-sm text-danger">
            {push.error}
          </p>
        ) : null}

        <Button
          variant={push.enabled ? "outline" : "primary"}
          size="sm"
          className="self-start"
          loading={push.busy}
          disabled={push.permission === "denied"}
          onClick={() => void (push.enabled ? push.disable() : push.enable())}
        >
          {push.enabled
            ? t("web.push_notifications.disable")
            : t("web.push_notifications.enable")}
        </Button>
      </CardContent>
    </Card>
  );
}
