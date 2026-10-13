import { useTranslation } from "react-i18next";

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/presentation/components/ui";
import { useClientLoyaltyCards, useLoyaltyHistory, usePendingRewards } from "@/presentation/hooks/use-loyalty";

export interface ClientLoyaltySectionProps {
  clientId: number;
}

/**
 * Client loyalty section (slice 1: visible earn/redeem; slice 2: card expiry
 * labels).
 *
 * - Reward banner when a completed-but-unredeemed reward is waiting.
 * - Own cards with progress + expiry label.
 * - Punch timeline, newest first, with loading / error+retry / empty states.
 */
export function ClientLoyaltySection({ clientId }: ClientLoyaltySectionProps) {
  const { t, i18n } = useTranslation();
  const historyQuery = useLoyaltyHistory(clientId);
  const pendingQuery = usePendingRewards(clientId);
  const cardsQuery = useClientLoyaltyCards(clientId);

  const pending = pendingQuery.data ?? [];
  const history = historyQuery.data ?? [];
  const cards = cardsQuery.data ?? [];
  const loading = historyQuery.isPending || pendingQuery.isPending || cardsQuery.isPending;
  const error = historyQuery.isError || pendingQuery.isError || cardsQuery.isError;

  const expiryLabel = (expiresAt?: string | null): string => {
    if (!expiresAt) return t("client.loyalty.no_expiry");
    const date = new Date(expiresAt);
    if (Number.isNaN(date.getTime())) return t("client.loyalty.no_expiry");
    return t("client.loyalty.expires_on", {
      date: date.toLocaleDateString(i18n.resolvedLanguage ?? i18n.language),
    });
  };

  return (
    <Card data-testid="client-loyalty-section">
      <CardHeader>
        <CardTitle>{t("client.loyalty.my_rewards")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <div role="status" aria-live="polite" className="flex flex-col gap-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error ? (
          <div role="alert" className="flex flex-col items-start gap-2">
            <p className="text-sm text-text-muted">{t("web.errors.loyalty_history_fetch")}</p>
            <Button
              variant="outline"
              onClick={() => {
                void cardsQuery.refetch();
                void historyQuery.refetch();
                void pendingQuery.refetch();
              }}
            >
              {t("common.retry")}
            </Button>
          </div>
        ) : (
          <>
            {pending.length > 0 ? (
              <div
                data-testid="loyalty-reward-banner"
                className="flex items-center gap-3 rounded-xl bg-amber-50 p-3"
              >
                <span aria-hidden="true" className="text-xl">🎁</span>
                <div className="flex min-w-0 flex-col">
                  <p className="text-sm font-semibold text-text">
                    {t("client.loyalty.reward_ready")}
                    {pending.length > 1 ? ` · ${pending.length}` : null}
                  </p>
                  <p className="truncate text-sm text-text-muted">
                    {pending[0].rewardDescription}
                    {pending[0].serviceName ? ` · ${pending[0].serviceName}` : null}
                  </p>
                </div>
                <Badge variant="accent" className="ml-auto shrink-0">
                  {t("client.loyalty.status_completed")}
                </Badge>
              </div>
            ) : null}

            {cards.length > 0 ? (
              <div data-testid="loyalty-cards" className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-text">{t("client.loyalty.cards_title")}</p>
                <ul className="flex flex-col gap-1.5">
                  {cards.map((card) => (
                    <li
                      key={card.id}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">
                        {card.loyalty_program.service_name?.trim()
                          ? card.loyalty_program.service_name
                          : t("client.loyalty.history_stamp")}
                      </span>
                      <span className="text-xs text-text-muted">
                        {t("client.loyalty.history_progress", {
                          stamps: card.current_steps,
                          required: card.loyalty_program.required_steps,
                        })}
                      </span>
                      <span className="text-xs text-text-secondary">
                        {expiryLabel(card.expires_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {history.length === 0 ? (
              <p data-testid="loyalty-history-empty" className="text-sm text-text-muted">
                {t("client.loyalty.history_empty")}
              </p>
            ) : (
              <div data-testid="loyalty-history-timeline" className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-text">{t("client.loyalty.history_title")}</p>
                <ul className="flex flex-col">
                  {history.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-1.5">
                      <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">
                        {item.serviceName ?? t("client.loyalty.history_stamp")}
                      </span>
                      <span className="shrink-0 text-sm text-text-muted">
                        {t("client.loyalty.history_progress", {
                          stamps: item.stamps,
                          required: item.required,
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
