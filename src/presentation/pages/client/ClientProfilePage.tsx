import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { imageUrl } from "yotuvia-core";

import { ClientProfileForm } from "@/presentation/components/client";
import { ClientLoyaltySection } from "@/presentation/components/client";
import { SecuritySection } from "@/presentation/components/client";
import { ProfileImageInput } from "@/presentation/components/profile";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  useToast,
} from "@/presentation/components/ui";
import { useAuthSession } from "@/presentation/hooks/use-auth-session";
import {
  useClientProfile,
  useUpdateClientProfile,
  useUploadClientAvatar,
} from "@/presentation/hooks/use-client";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { toErrorKey, useErrorMessage } from "@/presentation/lib/errors";
import { ROLE_LABEL_KEYS } from "@/presentation/lib/roles";
import type { ClientProfileFormValues } from "@/presentation/schemas/client.schemas";

/**
 * The signed-in client's own profile.
 *
 * READS `GET /client/me` through `getClientProfileUseCase` (no id: the JWT scopes
 * it). WRITES through `updateClientProfile` (`PUT /client/:id`), which the Go
 * service self-scopes: it returns 403 unless the path id matches the token.
 *
 * EDITABLE: first name, last name, username, email, phone. Those five are
 * `required` in `UpdateClientRequest`, and a successful save also refreshes the
 * session user so the topbar does not keep showing the old name until the next
 * login.
 *
 * The AVATAR uploads through `useUploadClientAvatar`: a browser `File` goes to
 * `POST /client/avatar` via the core `*File` seam, then the returned URL is
 * persisted with `PUT /client/:id` (`avatar_url`) and the session user is
 * synced so the topbar shows the new photo.
 *
 * NOT EDITABLE here, and why:
 * - the PASSWORD. The same endpoint accepts an optional `password`, but a
 *   dedicated change-password flow is its own slice; this page never sends it.
 */
export function ClientProfilePage() {
  const { t } = useTranslation();
  useDocumentTitle(t("client.profile.meta_title"));

  const { user, role, setSession } = useAuthSession();
  const { toast } = useToast();
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const profileQuery = useClientProfile();
  const updateMutation = useUpdateClientProfile();
  const avatarUpload = useUploadClientAvatar();
  const errorMessage = useErrorMessage(profileQuery.error, "web.errors.client_profile_fetch");
  const avatarErrorMessage =
    avatarUpload.validationErrorKey !== null
      ? t(avatarUpload.validationErrorKey)
      : avatarUpload.errorKey !== null
        ? t(avatarUpload.errorKey)
        : null;

  const clientId = Number(user?.id ?? 0);

  // The topbar renders the session photo when present: sync it from the
  // profile READ (login never carries `avatar_url` for any role). Guarded so
  // the store write cannot loop.
  useEffect(() => {
    const url = profileQuery.data?.avatarUrl ?? "";
    if (url !== "" && user !== null && user.avatarUrl !== url) {
      setSession({ ...user, avatarUrl: url });
    }
  }, [profileQuery.data, user, setSession]);

  const handleSubmit = async (values: ClientProfileFormValues) => {
    setErrorKey(null);
    try {
      await updateMutation.mutateAsync({ clientId, ...values });
      // Keep the session projection in sync with what was just saved: the shell
      // renders the user's name from the store, not from this query.
      if (user !== null) {
        setSession({
          ...user,
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          phone: values.phone,
        });
      }
      toast(t("client.profile.update_success"), { variant: "success" });
    } catch (error) {
      setErrorKey(toErrorKey(error, "web.errors.client_profile_save"));
    }
  };

  const handleAvatarSubmit = async () => {
    if (profileQuery.data === undefined || avatarUpload.file === null) return;
    const profile = profileQuery.data;
    try {
      const url = await avatarUpload.mutateAsync({
        clientId,
        file: avatarUpload.file,
        identity: {
          firstName: profile.firstName,
          lastName: profile.lastName,
          username: profile.username,
          email: profile.email,
          phone: profile.phone,
        },
      });
      avatarUpload.clearFile();
      // The shell can render the user's photo from the store, so sync it the
      // same way the identity save syncs the name.
      if (user !== null) {
        setSession({ ...user, avatarUrl: url });
      }
      toast(t("client.profile.avatar_update_success"), { variant: "success" });
    } catch {
      // The picker keeps the file, the preview and the previous photo; the
      // translated error renders through `avatarErrorMessage`.
    }
  };

  if (profileQuery.isPending) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={t("common.loading")}
        className="flex flex-col gap-4"
      >
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (profileQuery.isError) {
    return (
      <Card role="alert">
        <CardHeader>
          <CardTitle>{t("client.profile.error_title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">{errorMessage}</p>
          <Button
            variant="outline"
            className="self-start"
            onClick={() => void profileQuery.refetch()}
          >
            {t("common.retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const profile = profileQuery.data;
  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
  const avatar = imageUrl(profile.avatarUrl);

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-bold text-text">{t("client.profile.title")}</h2>

      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <ProfileImageInput
            currentSrc={avatar || null}
            alt={t("client.profile.avatar_alt")}
            file={avatarUpload.file}
            onFileChange={avatarUpload.selectFile}
            onSubmit={() => void handleAvatarSubmit()}
            submitting={avatarUpload.status === "uploading"}
            errorMessage={avatarErrorMessage}
            fallbackInitial={(profile.firstName.charAt(0) || "?").toUpperCase()}
          />

          <div className="flex min-w-0 flex-col gap-1">
            <p className="truncate text-base font-semibold text-text">
              {fullName || t("client.profile.default_name")}
            </p>
            <p className="truncate text-sm text-text-muted">{profile.email}</p>
            <div className="flex flex-wrap items-center gap-2">
              {role !== null ? <Badge variant="accent">{t(ROLE_LABEL_KEYS[role])}</Badge> : null}
              <Badge variant={profile.isActive ? "success" : "default"}>
                {profile.isActive ? t("common.active") : t("common.inactive")}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("client.profile.edit_profile_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {clientId > 0 ? (
            <ClientProfileForm
              profile={profile}
              saving={updateMutation.isPending}
              errorKey={errorKey}
              onSubmit={(values) => void handleSubmit(values)}
            />
          ) : (
            <p className="text-sm text-text-muted">{t("client.home.no_client")}</p>
          )}
        </CardContent>
      </Card>

      {clientId > 0 ? <ClientLoyaltySection clientId={clientId} /> : null}

      {clientId > 0 ? <SecuritySection /> : null}
    </div>
  );
}
