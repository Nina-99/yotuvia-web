import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  Button,
  Card,
  CardContent,
  EmptyState,
  Skeleton,
} from "@/presentation/components/ui";
import { formatCurrency } from "@/presentation/lib/format";
import { centerBookingPath, centerDetailPath } from "@/presentation/lib/routes";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import {
  usePersonnelFeed,
  usePersonnelProfile,
  useTogglePersonnelFollow,
} from "@/presentation/hooks/use-personnel";

/**
 * Public profile of one professional, reached from a credited video avatar.
 *
 * Mirrors the mobile `PersonnelProfileScreen`: the professional's photo, name,
 * follow and book actions, and a grid of their published videos. Tapping a video
 * opens the booking flow with that video's tagged service preselected.
 *
 * Lives in the CLIENT area because `GET /personnel/:id` requires a JWT.
 */
export function ProfessionalProfilePage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const params = useParams<{ personnelId: string }>();
  const personnelId = Number(params.personnelId ?? 0);

  const profileQuery = usePersonnelProfile(personnelId);
  const feedQuery = usePersonnelFeed(personnelId);
  const follow = useTogglePersonnelFollow(personnelId);

  const profile = profileQuery.data;
  const displayName = profile
    ? [profile.firstName, profile.lastName].filter(Boolean).join(" ") || `#${profile.id}`
    : "";
  useDocumentTitle(displayName || t("client.personnel.title"));

  if (profileQuery.isPending) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (profileQuery.isError || !profile) {
    return (
      <Card role="alert">
        <CardContent className="flex flex-col items-start gap-3 p-6">
          <p className="text-sm text-text-muted">{t("client.personnel.error_title")}</p>
          <Button variant="outline" onClick={() => void profileQuery.refetch()}>
            {t("client.personnel.retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const avatarUrl =
    profile.images?.find((img) => img.isProfile)?.imageUrl ??
    profile.images?.find((img) => img.isCover)?.imageUrl ??
    "";
  const initial = displayName.charAt(0).toUpperCase() || "?";
  const videos = feedQuery.data?.videos ?? [];
  const following = profile.isFollowing ?? false;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-24 w-24 rounded-full border-2 border-border object-cover"
            />
          ) : (
            <span className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-border bg-accent text-3xl font-bold text-on-accent">
              {initial}
            </span>
          )}

          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold text-text">{displayName}</h1>
            <Link
              to={centerDetailPath(profile.beautyCenterId)}
              className="text-sm text-link underline-offset-2 hover:underline"
            >
              {t("client.videos.view_profile")}
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant={following ? "outline" : "secondary"}
              loading={follow.isPending}
              aria-pressed={following}
              onClick={() => follow.mutate(!following)}
            >
              {following ? t("client.personnel.following") : t("client.personnel.follow")}
            </Button>
            <Button
              onClick={() =>
                navigate(centerBookingPath(profile.beautyCenterId, { personnelId: profile.id }))
              }
            >
              {t("client.personnel.book")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text">{t("client.personnel.videos_title")}</h2>

        {feedQuery.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : videos.length === 0 ? (
          <EmptyState
            title={t("client.personnel.videos_empty")}
            body={t("client.personnel.title")}
          />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {videos.map((video) => (
              <li key={video.id}>
                <Link
                  to={centerBookingPath(video.beautyCenterId, {
                    personnelId: profile.id,
                    ...(video.serviceId ? { serviceIds: [video.serviceId] } : {}),
                  })}
                  className="group block overflow-hidden rounded-lg border border-border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <div className="relative aspect-[9/16] bg-card2">
                    {video.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1 p-2">
                    <span className="truncate text-xs font-medium text-text">
                      {video.caption || video.serviceName || t("client.videos.view_profile")}
                    </span>
                    {video.serviceName ? (
                      <span className="truncate text-xs text-text-muted">
                        {video.serviceName}
                        {video.servicePrice != null
                          ? ` · ${formatCurrency(video.servicePrice, language)}`
                          : ""}
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
