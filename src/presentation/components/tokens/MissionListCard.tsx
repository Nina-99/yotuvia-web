import { useTranslation } from "react-i18next";
import { sortTokenMissions } from "yotuvia-core";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@/presentation/components/ui";
import { useClaimMissionReward, useTokenMissions } from "@/presentation/hooks/use-tokens";
import { useErrorMessage } from "@/presentation/lib/errors";
import { formatYtv } from "@/presentation/lib/format";

/**
 * Missions card for the owner tokens page. Order is shared with mobile via
 * `sortTokenMissions`: claimable first, then the closest to completion, then
 * already-claimed missions.
 */
export function MissionListCard() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const missionsQuery = useTokenMissions();
  const claim = useClaimMissionReward();
  const errorMessage = useErrorMessage(missionsQuery.error, "web.errors.tokens_fetch");
  const missions = sortTokenMissions(missionsQuery.data ?? []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("web.app.tokens.missions.title")}</CardTitle>
        <CardDescription>{t("web.app.tokens.missions.body")}</CardDescription>
      </CardHeader>
      <CardContent>
        {missionsQuery.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : missionsQuery.isError ? (
          <div role="alert" className="flex flex-col gap-3">
            <p className="text-sm text-text-muted">{errorMessage}</p>
            <Button
              variant="outline"
              className="self-start"
              onClick={() => void missionsQuery.refetch()}
            >
              {t("common.retry")}
            </Button>
          </div>
        ) : missions.length === 0 ? (
          <p className="text-sm text-text-muted">{t("web.app.tokens.missions.empty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {missions.map((mission) => {
              const progress =
                mission.target_count > 0
                  ? Math.min(100, Math.round((mission.current_count / mission.target_count) * 100))
                  : 0;
              return (
                <li
                  key={mission.id}
                  className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center"
                >
                  <span aria-hidden className="text-xl">
                    {mission.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text">{mission.name}</p>
                    <p className="text-xs text-text-muted">{mission.description}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div
                        className="h-1.5 flex-1 overflow-hidden rounded-full bg-border"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={mission.target_count}
                        aria-valuenow={mission.current_count}
                        aria-label={mission.name}
                      >
                        <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-[11px] font-semibold tabular-nums text-text-muted">
                        {mission.current_count}/{mission.target_count}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold tabular-nums text-text">
                      +{formatYtv(mission.reward_tokens, language)}
                    </span>
                    {mission.reward_claimed ? (
                      <Badge variant="default">{t("web.app.tokens.missions.claimed")}</Badge>
                    ) : mission.completed ? (
                      <Button
                        onClick={() => claim.mutate(mission.id)}
                        disabled={claim.isPending}
                      >
                        {t("web.app.tokens.missions.claim")}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
