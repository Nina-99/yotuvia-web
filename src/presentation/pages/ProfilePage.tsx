import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { imageUrl } from "yotuvia-core";

import {
  CenterProfileForm,
  GalleryManager,
  PaymentConfigForm,
  ProfileImageInput,
  SocialLinksForm,
} from "@/presentation/components/profile";
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
import { useAdminCenter } from "@/presentation/hooks/use-admin-center";
import { useAuthSession } from "@/presentation/hooks/use-auth-session";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { useCenterImages, useUpdateCenterProfile, useUploadCenterCover, useUploadCenterLogo } from "@/presentation/hooks/use-profile";
import { toErrorKey, useErrorMessage } from "@/presentation/lib/errors";
import { toCenterUpdatePayload } from "@/presentation/schemas/profile.schemas";
import type { CenterProfileFormValues } from "@/presentation/schemas/profile.schemas";

/**
 * Owner profile section: center data, gallery, social links and payment config.
 *
 * The page owns the center query + profile save and composes the four section
 * components, which each own their own data. Seam choices per surface (source
 * functions, use-cases and the payment exception) are documented on
 * `use-profile.ts`.
 *
 * The center read reuses `useAdminCenter` (`queryKeys.admin.center`) so the
 * dashboard, promotions, loyalty and profile pages all share one cache entry.
 */
/**
 * Account-header card: the center LOGO (`is_profile`) and COVER (`is_cover`)
 * pickers with previews.
 *
 * Each picker uploads its binary through `POST /beauty-image/upload` and
 * persists it as a new gallery row carrying exactly ONE flag; the previously
 * flagged row is unset so at most one logo and one cover survive (same
 * exclusivity `GalleryManager.setFlag` enforces). The gallery URL-add below
 * stays untouched — it manages hosted URLs, this card manages identity files.
 */
function CenterAccountHeaderCard({ centerId }: { centerId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user, setSession } = useAuthSession();

  const imagesQuery = useCenterImages(centerId);
  const logoUpload = useUploadCenterLogo();
  const coverUpload = useUploadCenterCover();

  const images = imagesQuery.data ?? [];
  const logo = images.find((image) => image.isProfile) ?? null;
  const cover = images.find((image) => image.isCover) ?? null;

  // The topbar renders the session photo when present: sync the persisted
  // logo here (login never carries gallery URLs). Guarded so the store write
  // cannot loop.
  useEffect(() => {
    const next = logo ? imageUrl(logo.imageUrl) : "";
    if (next !== "" && user !== null && user.avatarUrl !== next) {
      setSession({ ...user, avatarUrl: next });
    }
  }, [logo, user, setSession]);

  const logoErrorMessage =
    logoUpload.validationErrorKey !== null
      ? t(logoUpload.validationErrorKey)
      : logoUpload.errorKey !== null
        ? t(logoUpload.errorKey)
        : null;
  const coverErrorMessage =
    coverUpload.validationErrorKey !== null
      ? t(coverUpload.validationErrorKey)
      : coverUpload.errorKey !== null
        ? t(coverUpload.errorKey)
        : null;

  const handleLogoSubmit = async () => {
    if (logoUpload.file === null) return;
    try {
      const url = await logoUpload.mutateAsync({ centerId, file: logoUpload.file, keptImages: images });
      logoUpload.clearFile();
      // Same session sync as the other profiles: the topbar reads the photo
      // from the store, not from this query.
      if (user !== null) {
        setSession({ ...user, avatarUrl: url });
      }
      toast(t("web.profile_image.success"), { variant: "success" });
    } catch {
      // The picker keeps the file, the preview and the previous logo; the
      // translated error renders through `logoErrorMessage`.
    }
  };

  const handleCoverSubmit = async () => {
    if (coverUpload.file === null) return;
    try {
      await coverUpload.mutateAsync({ centerId, file: coverUpload.file, keptImages: images });
      coverUpload.clearFile();
      toast(t("web.profile_image.success"), { variant: "success" });
    } catch {
      // The picker keeps the file, the preview and the previous cover; the
      // translated error renders through `coverErrorMessage`.
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("web.profile_image.center_card_title")}</CardTitle>
        <p className="text-sm text-text-muted">{t("web.profile_image.center_card_subtitle")}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold text-text">{t("web.profile_image.center_logo_title")}</h4>
          <ProfileImageInput
            currentSrc={logo ? imageUrl(logo.imageUrl) : null}
            alt={t("web.profile_image.center_logo_alt")}
            file={logoUpload.file}
            onFileChange={logoUpload.selectFile}
            onSubmit={() => void handleLogoSubmit()}
            submitting={logoUpload.status === "uploading"}
            errorMessage={logoErrorMessage}
            fallbackInitial="?"
          />
        </div>
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold text-text">{t("web.profile_image.center_cover_title")}</h4>
          <ProfileImageInput
            currentSrc={cover ? imageUrl(cover.imageUrl) : null}
            alt={t("web.profile_image.center_cover_alt")}
            file={coverUpload.file}
            onFileChange={coverUpload.selectFile}
            onSubmit={() => void handleCoverSubmit()}
            submitting={coverUpload.status === "uploading"}
            errorMessage={coverErrorMessage}
            fallbackInitial="?"
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function ProfilePage() {
  const { t } = useTranslation();
  useDocumentTitle(t("web.app.profile.meta.title"));

  const { user } = useAuthSession();
  const centerId = Number(user?.id ?? 0);
  const { toast } = useToast();

  const [saveErrorKey, setSaveErrorKey] = useState<string | null>(null);

  const centerQuery = useAdminCenter(centerId);
  const updateCenter = useUpdateCenterProfile();
  const errorMessage = useErrorMessage(centerQuery.error, "web.errors.profile_fetch");

  const handleSave = async (values: CenterProfileFormValues) => {
    setSaveErrorKey(null);
    try {
      await updateCenter.mutateAsync({ centerId, data: toCenterUpdatePayload(values) });
      toast(t("web.app.profile.details.save_success"), { variant: "success" });
    } catch (error) {
      setSaveErrorKey(toErrorKey(error, "web.errors.profile_save"));
    }
  };

  if (centerId <= 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("web.app.profile.error_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-muted">{t("web.app.profile.no_center")}</p>
        </CardContent>
      </Card>
    );
  }

  if (centerQuery.isPending) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={t("common.loading")}
        className="flex flex-col gap-6"
      >
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (centerQuery.isError || !centerQuery.data) {
    return (
      <Card role="alert">
        <CardHeader>
          <CardTitle>{t("web.app.profile.error_title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">{errorMessage}</p>
          <Button variant="outline" className="self-start" onClick={() => void centerQuery.refetch()}>
            {t("common.retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const center = centerQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-text">{t("web.app.profile.title")}</h2>
          <p className="text-sm text-text-secondary">{t("web.app.profile.subtitle")}</p>
        </div>
        <Badge variant={center.isActive ? "success" : "warning"}>
          {center.isActive
            ? t("web.app.profile.status.active")
            : t("web.app.profile.status.inactive")}
        </Badge>
      </div>

      <section aria-labelledby="profile-account-header-title">
        <h3 id="profile-account-header-title" className="sr-only">
          {t("web.profile_image.center_card_title")}
        </h3>
        <CenterAccountHeaderCard centerId={centerId} />
      </section>

      <section aria-labelledby="profile-details-title">
        <h3 id="profile-details-title" className="sr-only">
          {t("web.app.profile.details.section_title")}
        </h3>
        <CenterProfileForm
          center={center}
          saving={updateCenter.isPending}
          errorKey={saveErrorKey}
          onSubmit={(values) => void handleSave(values)}
        />
      </section>

      <section aria-labelledby="profile-gallery-title">
        <h3 id="profile-gallery-title" className="sr-only">
          {t("web.app.profile.gallery.title")}
        </h3>
        <GalleryManager centerId={centerId} />
      </section>

      <section aria-labelledby="profile-social-title">
        <h3 id="profile-social-title" className="sr-only">
          {t("web.app.profile.social.title")}
        </h3>
        <SocialLinksForm centerId={centerId} />
      </section>

      <section aria-labelledby="profile-payments-title">
        <h3 id="profile-payments-title" className="sr-only">
          {t("web.app.profile.payments.title")}
        </h3>
        <PaymentConfigForm centerId={centerId} />
      </section>
    </div>
  );
}
