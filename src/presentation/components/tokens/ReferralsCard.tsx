import { useState } from "react";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Skeleton,
  useToast,
} from "@/presentation/components/ui";
import {
  useCreateReferral,
  useReferralInfo,
  useReferrals,
} from "@/presentation/hooks/use-tokens";
import { formatYtv } from "@/presentation/lib/format";

/**
 * Referral card: share the unique code or link, show the invited centers and
 * let the owner enter someone else's code. The link targets the web register
 * page with `?ref=`, where the code is prefilled.
 */
export function ReferralsCard() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const { toast } = useToast();
  const info = useReferralInfo();
  const referrals = useReferrals();
  const create = useCreateReferral();
  const [code, setCode] = useState("");

  const referralCode = info.data?.referral_code ?? "";
  const link = referralCode ? `${window.location.origin}/register?ref=${referralCode}` : "";

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast(t("web.app.tokens.referrals.copied"), { variant: "success" });
    } catch {
      // Clipboard can be unavailable (insecure context): the value is visible.
    }
  };

  const share = async () => {
    if (!link) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: t("web.app.tokens.referrals.title"),
          text: t("web.app.tokens.referrals.share_text"),
          url: link,
        });
        return;
      } catch {
        // Fall through to copy.
      }
    }
    await copy(link);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("web.app.tokens.referrals.title")}</CardTitle>
        <CardDescription>{t("web.app.tokens.referrals.body")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {info.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : info.isError ? (
          <p className="text-sm text-text-muted">{t("web.app.tokens.referrals.error")}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">
                  {t("web.app.tokens.referrals.code")}
                </span>
                <span className="rounded-md border border-border px-3 py-1 font-mono text-lg font-bold tracking-widest">
                  {referralCode}
                </span>
              </div>
              <Button variant="outline" onClick={() => void copy(referralCode)}>
                {t("web.app.tokens.referrals.copy_code")}
              </Button>
              <Button variant="outline" onClick={() => void copy(link)}>
                {t("web.app.tokens.referrals.copy_link")}
              </Button>
              <Button onClick={() => void share()}>
                {t("web.app.tokens.referrals.share")}
              </Button>
            </div>
            <p className="break-all text-xs text-text-muted">{link}</p>
            {link ? (
              <div className="self-start rounded-md bg-white p-2">
                <QRCodeSVG value={link} size={120} />
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">
                {t("web.app.tokens.referrals.enter_title")}
              </span>
              <div className="flex flex-wrap gap-2">
                <Input
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder={t("web.app.tokens.referrals.enter_placeholder")}
                  className="max-w-xs"
                />
                <Button
                  disabled={create.isPending || code.trim().length === 0}
                  onClick={() => create.mutate({ code: code.trim() })}
                >
                  {t("web.app.tokens.referrals.enter_button")}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold">
                {t("web.app.tokens.referrals.list_title")}
              </span>
              {(referrals.data ?? []).length === 0 ? (
                <span className="text-sm text-text-muted">
                  {t("web.app.tokens.referrals.empty")}
                </span>
              ) : (
                <ul className="divide-y divide-border">
                  {(referrals.data ?? []).map((referral) => (
                    <li
                      key={referral.id}
                      className="flex items-center justify-between gap-3 py-2 text-sm"
                    >
                      <Badge variant="default">
                        {t(`web.app.tokens.referrals.status.${referral.status}`, {
                          defaultValue: referral.status,
                        })}
                      </Badge>
                      <span className="tabular-nums text-text">
                        +{formatYtv(referral.reward_referrer, language)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
