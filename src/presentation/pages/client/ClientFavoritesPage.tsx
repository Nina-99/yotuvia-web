import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { FavoriteCenter } from "yotuvia-core";

import { Button, Card, CardContent, ConfirmDialog, EmptyState, Skeleton, useToast } from "@/presentation/components/ui";
import { useAuthSession } from "@/presentation/hooks/use-auth-session";
import { useClientFavorites, useRemoveClientFavorite } from "@/presentation/hooks/use-client";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { useErrorMessage } from "@/presentation/lib/errors";
import { centerDetailPath } from "@/presentation/lib/routes";

/**
 * Display name of a favorite's center.
 *
 * A stored center name can be blank (verified live on the platform console), so
 * the id-based fallback keeps the card and the confirmation dialog readable
 * instead of rendering an empty label.
 */
function favoriteCenterName(
  favorite: FavoriteCenter,
  fallback: string,
): string {
  return favorite.beautyCenter.name.trim() ? favorite.beautyCenter.name : fallback;
}

/**
 * The signed-in client's favorite centers.
 *
 * `GET /clients/:clientId/favorites` returns favorite ROWS, so the delete target
 * is `favorite.id` (never the center id) — mixing the two would delete someone
 * else's row. Removal asks for confirmation because the API offers no undo, and
 * the list must come back without the row, which is why the mutation
 * invalidates this list.
 *
 * Each card links through the shared `centerDetailPath` helper (the same one the
 * public landing search uses), so the public detail page is wired once for every
 * center card in the app.
 */
export function ClientFavoritesPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("client.favorites.meta_title"));

  const { user } = useAuthSession();
  const clientId = Number(user?.id ?? 0);
  const { toast } = useToast();

  const [pendingRemoval, setPendingRemoval] = useState<FavoriteCenter | null>(null);

  const favoritesQuery = useClientFavorites(clientId);
  const removeMutation = useRemoveClientFavorite();

  const errorMessage = useErrorMessage(favoritesQuery.error, "web.errors.client_favorites_fetch");

  const handleConfirmRemoval = async () => {
    if (pendingRemoval === null) return;
    try {
      await removeMutation.mutateAsync({
        clientId,
        favoriteId: pendingRemoval.id,
      });
      setPendingRemoval(null);
      toast(t("client.favorites.remove_success"), { variant: "success" });
    } catch {
      // `removeMutation.errorKey` keeps the dialog open with the message.
    }
  };

  if (clientId <= 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-text-muted">{t("client.home.no_client")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="ytv-display text-3xl font-bold text-text">{t("client.favorites.title")}</h2>

      {favoritesQuery.isPending ? (
        <div
          role="status"
          aria-live="polite"
          aria-label={t("common.loading")}
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-36 w-full" />
          ))}
        </div>
      ) : favoritesQuery.isError ? (
        <Card role="alert">
          <CardContent className="flex flex-col gap-4 p-4">
            <p className="text-sm text-text-muted">{errorMessage}</p>
            <Button
              variant="outline"
              className="self-start"
              onClick={() => void favoritesQuery.refetch()}
            >
              {t("common.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : favoritesQuery.data.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-8 text-center">
            <EmptyState
              title={t("client.favorites.empty")}
              body={t("client.favorites.empty_body")}
            />
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {favoritesQuery.data.map((favorite) => {
            const name = favoriteCenterName(
              favorite,
              t("client.center.center_prefix", { id: favorite.beautyCenterId }),
            );
            const address = favorite.beautyCenter.address.trim()
              ? favorite.beautyCenter.address
              : t("client.center.no_address");

            return (
              <li key={favorite.id}>
                <Card className="h-full">
                  <CardContent className="flex h-full flex-col gap-2 p-4">
                    <h3 className="text-sm font-semibold text-text">{name}</h3>
                    <p className="text-xs text-text-muted">{address}</p>
                    {favorite.beautyCenter.phone ? (
                      <p className="text-xs text-text-muted">
                        {t("client.favorites.phone")}:{" "}
                        <span dir="ltr">{favorite.beautyCenter.phone}</span>
                      </p>
                    ) : null}

                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                      <Link
                        to={centerDetailPath(favorite.beautyCenterId)}
                        className="inline-flex items-center rounded-lg text-sm font-semibold text-link underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {t("client.center.view")}
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPendingRemoval(favorite)}
                      >
                        {t("client.favorites.remove")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {favoritesQuery.data && favoritesQuery.data.length > 0 ? (
        <p className="text-xs text-text-muted">
          {t("client.favorites.count", { count: favoritesQuery.data.length })}
        </p>
      ) : null}

      <ConfirmDialog
        open={pendingRemoval !== null}
        title={t("client.favorites.remove_confirm_title")}
        description={t("client.favorites.remove_confirm_body", {
          name:
            pendingRemoval === null
              ? ""
              : favoriteCenterName(
                  pendingRemoval,
                  t("client.center.center_prefix", { id: pendingRemoval.beautyCenterId }),
                ),
        })}
        confirmLabel={t("client.favorites.remove")}
        cancelLabel={t("common.cancel")}
        closeLabel={t("common.close")}
        loading={removeMutation.isPending}
        error={removeMutation.errorKey}
        onConfirm={() => void handleConfirmRemoval()}
        onCancel={() => setPendingRemoval(null)}
      />
    </div>
  );
}
