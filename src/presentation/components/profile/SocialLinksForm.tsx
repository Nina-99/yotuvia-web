import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SocialMedia } from "yotuvia-core";

import { Form, FormAlert, FormField, useZodForm } from "@/presentation/components/form";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Skeleton,
} from "@/presentation/components/ui";
import { useCenterSocialMedia, useUpsertCenterSocialMedia } from "@/presentation/hooks/use-profile";
import { toErrorKey, useErrorMessage } from "@/presentation/lib/errors";
import {
  SOCIAL_LINK_FIELDS,
  socialMediaSchema,
  socialToFormValues,
} from "@/presentation/schemas/profile.schemas";
import type { SocialMediaFormValues } from "@/presentation/schemas/profile.schemas";

const LINK_LABEL_KEYS: Readonly<Record<(typeof SOCIAL_LINK_FIELDS)[number], string>> = {
  google: "web.app.profile.social.google",
  facebook: "web.app.profile.social.facebook",
  instagram: "web.app.profile.social.instagram",
  twitter: "web.app.profile.social.twitter",
  tiktok: "web.app.profile.social.tiktok",
};

interface SocialLinksFieldsProps {
  social: SocialMedia | null;
  saving: boolean;
  errorKey: string | null;
  onSubmit: (values: SocialMediaFormValues) => void;
}

/**
 * The editable fields.
 *
 * Mounted only after the query resolves (the parent gates it), so the draft
 * seeds from the server payload in the `useState`/`defaultValues` initializer
 * and no effect has to sync server state into form state.
 */
function SocialLinksFields({
  social,
  saving,
  errorKey,
  onSubmit,
}: SocialLinksFieldsProps) {
  const { t } = useTranslation();
  const form = useZodForm<SocialMediaFormValues>({
    schema: socialMediaSchema,
    defaultValues: socialToFormValues(social),
  });

  return (
    <Form form={form} id="social-links-form" className="flex flex-col gap-4" onSubmit={onSubmit}>
      <FormAlert message={errorKey} variant="error" />
      <p className="text-xs text-text-muted">{t("web.app.profile.social.clear_hint")}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {SOCIAL_LINK_FIELDS.map((link) => (
          <FormField key={link} name={link} label={t(LINK_LABEL_KEYS[link])}>
            {({ field, invalid, describedBy, id }) => (
              <Input
                {...field}
                id={id}
                type="url"
                placeholder="https://"
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              />
            )}
          </FormField>
        ))}
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={saving}>
          {t("web.app.profile.social.save")}
        </Button>
      </div>
    </Form>
  );
}

/**
 * Social-links section.
 *
 * All five links are `omitempty,url` in the API, so an empty field is skipped
 * rather than sent — and because the Go service ignores empty strings, a link
 * cannot be DELETED from here once stored. The helper copy states that
 * limitation instead of pretending removal works.
 */
export function SocialLinksForm({ centerId }: { centerId: number }) {
  const { t } = useTranslation();
  const socialQuery = useCenterSocialMedia(centerId);
  const upsert = useUpsertCenterSocialMedia();
  const errorMessage = useErrorMessage(socialQuery.error, "web.errors.profile_social_fetch");
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const handleSubmit = async (values: SocialMediaFormValues) => {
    setErrorKey(null);
    try {
      await upsert.mutateAsync({ centerId, ...values });
    } catch (error) {
      setErrorKey(toErrorKey(error, "web.errors.profile_social_save"));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("web.app.profile.social.title")}</CardTitle>
        <p className="text-sm text-text-muted">{t("web.app.profile.social.subtitle")}</p>
      </CardHeader>
      <CardContent>
        {socialQuery.isPending ? (
          <div
            role="status"
            aria-live="polite"
            aria-label={t("common.loading")}
            className="flex flex-col gap-3"
          >
            {Array.from({ length: 2 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : socialQuery.isError ? (
          <div role="alert" className="flex flex-col gap-3">
            <p className="text-sm text-text-muted">{errorMessage}</p>
            <Button variant="outline" className="self-start" onClick={() => void socialQuery.refetch()}>
              {t("common.retry")}
            </Button>
          </div>
        ) : (
          <SocialLinksFields
            social={socialQuery.data ?? null}
            saving={upsert.isPending}
            errorKey={errorKey}
            onSubmit={(values) => void handleSubmit(values)}
          />
        )}
      </CardContent>
    </Card>
  );
}
