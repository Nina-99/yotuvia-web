import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { imageUrl } from "yotuvia-core";

import { StaffProfileForm } from "@/presentation/components/staff/StaffProfileForm";
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
  useStaffProfile,
  useUpdateStaffProfile,
  useUploadStaffAvatar,
} from "@/presentation/hooks/use-staff";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { toErrorKey, useErrorMessage } from "@/presentation/lib/errors";
import { ROLE_LABEL_KEYS } from "@/presentation/lib/roles";
import { staffProfileToUpdateData } from "@/presentation/schemas/staff.schemas";
import type { StaffProfileFormValues } from "@/presentation/schemas/staff.schemas";

/**
 * The signed-in professional's own profile.
 *
 * READS `GET /personnel/:id` (`getStaffProfileUseCase`) and WRITES through
 * `updateStaffProfileUseCase` (`PATCH /personnel/me`).
 *
 * EDITABLE: first name, last name, phone, password — exactly the allow-listed
 * DTO — plus the profile PHOTO through `useUploadStaffAvatar` (binary upload,
 * then PATCH with the reconciled full set so kept images survive).
 *
 * READ-ONLY, and stated as such structurally rather than faked: EMAIL and the
 * ACTIVE FLAG render as text because the backend rejects identity fields with
 * a 403.
 */
export function StaffProfilePage() {
  const { t } = useTranslation();
  useDocumentTitle(t("staff.profile.meta_title"));

  const { user, role, setSession } = useAuthSession();
  const { toast } = useToast();
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const profileId = Number(user?.id ?? 0);
  const profileQuery = useStaffProfile(profileId);
  const updateMutation = useUpdateStaffProfile();
  const avatarUpload = useUploadStaffAvatar();
  const errorMessage = useErrorMessage(profileQuery.error, "web.errors.staff_profile_fetch");
  const avatarErrorMessage =
    avatarUpload.validationErrorKey !== null
      ? t(avatarUpload.validationErrorKey)
      : avatarUpload.errorKey !== null
        ? t(avatarUpload.errorKey)
        : null;

  // The topbar renders the session photo when present: sync the persisted
  // avatar here (login never carries personnel gallery URLs). Guarded so the
  // store write cannot loop.
  useEffect(() => {
    const current = profileQuery.data?.images.find((image) => image.isProfile) ?? null;
    const next = current ? imageUrl(current.imageUrl) : "";
    if (next !== "" && user !== null && user.avatarUrl !== next) {
      setSession({ ...user, avatarUrl: next });
    }
  }, [profileQuery.data, user, setSession]);

  const handleSubmit = async (values: StaffProfileFormValues): Promise<boolean> => {
    setErrorKey(null);
    try {
      await updateMutation.mutateAsync({
        profileId,
        data: staffProfileToUpdateData(values),
      });
      // Keep the shell's session projection in sync with what was just saved;
      // the topbar reads the user's name from the store, not from this query.
      if (user !== null) {
        setSession({
          ...user,
          firstName: values.firstName,
          lastName: values.lastName,
          phone: values.phone,
        });
      }
      toast(t("staff.profile.saved"), { variant: "success" });
      return true;
    } catch (error) {
      setErrorKey(toErrorKey(error, "web.errors.staff_profile_save"));
      return false;
    }
  };

  const handleAvatarSubmit = async () => {
    if (profileQuery.data === undefined || avatarUpload.file === null) return;
    try {
      const url = await avatarUpload.mutateAsync({
        profileId,
        file: avatarUpload.file,
        keptImages: profileQuery.data.images,
      });
      avatarUpload.clearFile();
      // Same session sync as the identity save: the topbar reads the photo
      // from the store, not from this query.
      if (user !== null) {
        setSession({ ...user, avatarUrl: url });
      }
      toast(t("staff.profile.saved"), { variant: "success" });
    } catch {
      // The picker keeps the file, the preview and the previous photo; the
      // translated error renders through `avatarErrorMessage`.
    }
  };

  if (profileId <= 0) {
    return (
      <Card role="alert">
        <CardHeader>
          <CardTitle>{t("staff.profile.error_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-muted">{t("staff.profile.no_profile")}</p>
        </CardContent>
      </Card>
    );
  }

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
          <CardTitle>{t("staff.profile.error_title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">{errorMessage}</p>
          <Button variant="outline" className="self-start" onClick={() => void profileQuery.refetch()}>
            {t("common.retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const profile = profileQuery.data;
  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
  const avatarImage = profile.images.find((image) => image.isProfile) ?? null;
  const avatar = avatarImage ? imageUrl(avatarImage.imageUrl) : null;

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-bold text-text">{t("staff.profile.title")}</h2>

      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <ProfileImageInput
            currentSrc={avatar || null}
            alt={t("staff.profile.avatar_alt")}
            file={avatarUpload.file}
            onFileChange={avatarUpload.selectFile}
            onSubmit={() => void handleAvatarSubmit()}
            submitting={avatarUpload.status === "uploading"}
            errorMessage={avatarErrorMessage}
            fallbackInitial={(profile.firstName.charAt(0) || "?").toUpperCase()}
          />

          <div className="flex min-w-0 flex-col gap-1">
            <p className="truncate text-base font-semibold text-text">
              {fullName || t("staff.profile.default_name")}
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
          <CardTitle>{t("staff.profile.edit_profile_title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text">{t("staff.profile.email")}</span>
            <span className="text-sm text-text-muted">{profile.email}</span>
          </div>
          <StaffProfileForm
            profile={profile}
            saving={updateMutation.isPending}
            errorKey={errorKey}
            onSubmit={handleSubmit}
          />
        </CardContent>
      </Card>
    </div>
  );
}
