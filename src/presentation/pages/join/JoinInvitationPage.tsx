import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { Form, FormAlert, FormField } from "@/presentation/components/form";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Skeleton,
} from "@/presentation/components/ui";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { useJoinInvitation } from "@/presentation/hooks/use-join-invitation";
import { PublicLayout } from "@/presentation/layouts/PublicLayout";
import { formatDateTime } from "@/presentation/lib/format";
import { ROUTES } from "@/presentation/lib/routes";

function BackToSignIn() {
  const { t } = useTranslation();
  return (
    <Link
      to={ROUTES.login}
      className="text-sm font-semibold text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {t("web.join.back_to_login")}
    </Link>
  );
}

function centered(children: ReactNode) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">{children}</div>
  );
}

/**
 * PUBLIC staff invitation acceptance page (`/join/:token`).
 *
 * Registered OUTSIDE every auth boundary: the invited professional is signed
 * out. The hook fetches the preview (center name, invited email, expiry) and
 * drives the acceptance form; a valid submit creates the professional and sends
 * the invitee to sign in. Invalid, expired and already-used tokens all collapse
 * into one translated state instead of leaking raw server errors.
 */
export function JoinInvitationPage() {
  const { t, i18n } = useTranslation();
  const { token } = useParams<{ token: string }>();
  useDocumentTitle(t("web.join.meta_title"));

  const { state, invitation, errorKey, form, submit, submitting, retry } =
    useJoinInvitation(token);

  if (state === "loading" || (state === "ready" && !invitation)) {
    return (
      <PublicLayout>
        <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-12">
          <div role="status" aria-live="polite" aria-label={t("web.join.loading")}>
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </PublicLayout>
    );
  }

  if (state === "invalid") {
    return (
      <PublicLayout>
        {centered(
          <Card role="alert">
            <CardHeader>
              <CardTitle>{t("web.join.invalid.title")}</CardTitle>
              <CardDescription>{t("web.join.invalid.body")}</CardDescription>
            </CardHeader>
            <CardContent>
              <BackToSignIn />
            </CardContent>
          </Card>,
        )}
      </PublicLayout>
    );
  }

  if (state === "error" || !invitation) {
    return (
      <PublicLayout>
        {centered(
          <Card role="alert">
            <CardHeader>
              <CardTitle>{t("web.join.error.title")}</CardTitle>
              <CardDescription>{t("web.join.error.body")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <FormAlert message={errorKey} />
              <div className="flex flex-wrap items-center gap-4">
                <Button variant="outline" onClick={retry}>
                  {t("common.retry")}
                </Button>
                <BackToSignIn />
              </div>
            </CardContent>
          </Card>,
        )}
      </PublicLayout>
    );
  }

  const rows: ReadonlyArray<{ label: string; value: string }> = [
    { label: t("web.join.preview.center"), value: invitation.centerName },
    { label: t("web.join.preview.email"), value: invitation.email },
    {
      label: t("web.join.preview.expires"),
      value: formatDateTime(invitation.expiresAt, i18n.language),
    },
  ];

  return (
    <PublicLayout>
      {centered(
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t("web.join.title")}</CardTitle>
              <CardDescription>
                {t("web.join.subtitle", { center: invitation.centerName })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-2 text-sm">
                {rows.map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-4">
                    <dt className="text-text-muted">{row.label}</dt>
                    <dd className="text-right font-medium text-text">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("web.join.form.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Form
                form={form}
                className="flex flex-col gap-4"
                onSubmit={(values) => void submit(values)}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField name="firstName" label={t("web.join.form.first_name")}>
                    {({ field, invalid, id, describedBy }) => (
                      <Input
                        {...field}
                        id={id}
                        autoComplete="given-name"
                        aria-invalid={invalid || undefined}
                        aria-describedby={describedBy}
                      />
                    )}
                  </FormField>
                  <FormField name="lastName" label={t("web.join.form.last_name")}>
                    {({ field, invalid, id, describedBy }) => (
                      <Input
                        {...field}
                        id={id}
                        autoComplete="family-name"
                        aria-invalid={invalid || undefined}
                        aria-describedby={describedBy}
                      />
                    )}
                  </FormField>
                </div>

                <FormField name="phone" label={t("web.join.form.phone")}>
                  {({ field, invalid, id, describedBy }) => (
                    <Input
                      {...field}
                      id={id}
                      type="tel"
                      autoComplete="tel"
                      placeholder={t("web.join.form.phone_placeholder")}
                      aria-invalid={invalid || undefined}
                      aria-describedby={describedBy}
                    />
                  )}
                </FormField>

                <FormField
                  name="password"
                  label={t("web.join.form.password")}
                  helperText={t("web.join.form.password_hint")}
                >
                  {({ field, invalid, id, describedBy }) => (
                    <Input
                      {...field}
                      id={id}
                      type="password"
                      autoComplete="new-password"
                      placeholder={t("web.join.form.password_placeholder")}
                      aria-invalid={invalid || undefined}
                      aria-describedby={describedBy}
                    />
                  )}
                </FormField>

                <FormField name="confirmPassword" label={t("web.join.form.confirm_password")}>
                  {({ field, invalid, id, describedBy }) => (
                    <Input
                      {...field}
                      id={id}
                      type="password"
                      autoComplete="new-password"
                      placeholder={t("web.join.form.confirm_password_placeholder")}
                      aria-invalid={invalid || undefined}
                      aria-describedby={describedBy}
                    />
                  )}
                </FormField>

                <FormAlert message={errorKey} />

                <Button type="submit" size="lg" loading={submitting} className="w-full">
                  {submitting ? t("web.join.form.submitting") : t("web.join.form.submit")}
                </Button>
              </Form>
            </CardContent>
          </Card>
        </>,
      )}
    </PublicLayout>
  );
}
