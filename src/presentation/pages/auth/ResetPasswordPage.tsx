import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";

import { Form, FormAlert, FormField, useZodForm } from "@/presentation/components/form";
import {
  Button,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@/presentation/components/ui";
import { useResetPassword } from "@/presentation/hooks/use-auth";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { AuthLayout } from "@/presentation/layouts/AuthLayout";
import { getErrorStatus, toErrorKey } from "@/presentation/lib/errors";
import { ROUTES } from "@/presentation/lib/routes";
import { resetPasswordSchema } from "@/presentation/schemas/auth.schemas";
import type { ResetPasswordFormValues } from "@/presentation/schemas/auth.schemas";
import { useAuthStore } from "@/presentation/stores/use-auth-store";

type ResetState = "form" | "success" | "invalid";

const RESET_ERROR_FALLBACK = "errors.auth_reset_password";

/**
 * Redeems a single-use reset token from the URL query.
 *
 * A missing token and a rejected token (400) land on the same invalid state
 * with a way to request a fresh link. On success every server session has been
 * revoked, so the local session is cleared before the user is sent to login.
 */
export function ResetPasswordPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("web.auth.reset.meta.title"));

  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [state, setState] = useState<ResetState>(() => (token ? "form" : "invalid"));
  const [formError, setFormError] = useState<string | null>(null);

  const form = useZodForm({
    schema: resetPasswordSchema,
    defaultValues: { password: "", confirmPassword: "" },
  });
  const resetPassword = useResetPassword();
  const logout = useAuthStore((store) => store.logout);

  const onSubmit = async (values: ResetPasswordFormValues) => {
    setFormError(null);
    try {
      await resetPassword.mutateAsync({ token, password: values.password });
      // The reset revoked every session server-side; drop the stale local one.
      await logout();
      setState("success");
    } catch (error) {
      if (getErrorStatus(error) === 400) {
        setState("invalid");
        return;
      }
      setFormError(toErrorKey(error, RESET_ERROR_FALLBACK));
    }
  };

  if (state === "success") {
    return (
      <AuthLayout>
        <CardHeader>
          <CardTitle>{t("web.auth.reset.success_title")}</CardTitle>
          <CardDescription>{t("web.auth.reset.success_message")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            to={ROUTES.login}
            className="block rounded text-center text-sm font-semibold text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t("web.auth.reset.go_to_login")}
          </Link>
        </CardContent>
      </AuthLayout>
    );
  }

  if (state === "invalid") {
    return (
      <AuthLayout>
        <CardHeader>
          <CardTitle>{t("web.auth.reset.invalid_title")}</CardTitle>
          <CardDescription>{t("web.auth.reset.invalid_message")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Link
            to={ROUTES.forgotPassword}
            className="block rounded text-center text-sm font-semibold text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t("web.auth.reset.request_new_link")}
          </Link>
          <Link
            to={ROUTES.login}
            className="block rounded text-center text-sm font-medium text-text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t("web.auth.forgot.back_to_login")}
          </Link>
        </CardContent>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <CardHeader>
        <CardTitle>{t("web.auth.reset.title")}</CardTitle>
        <CardDescription>{t("web.auth.reset.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form form={form} onSubmit={onSubmit} className="flex flex-col gap-4">
          <FormField name="password" label={t("web.auth.fields.password")}>
            {({ field, invalid, id, describedBy }) => (
              <Input
                {...field}
                id={id}
                type="password"
                autoComplete="new-password"
                placeholder={t("web.auth.fields.password_placeholder")}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              />
            )}
          </FormField>

          <FormField name="confirmPassword" label={t("web.auth.fields.confirm_password")}>
            {({ field, invalid, id, describedBy }) => (
              <Input
                {...field}
                id={id}
                type="password"
                autoComplete="new-password"
                placeholder={t("web.auth.fields.confirm_password_placeholder")}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              />
            )}
          </FormField>

          <FormAlert message={formError} />

          <Button type="submit" size="lg" loading={resetPassword.isPending} className="w-full">
            {resetPassword.isPending
              ? t("web.auth.reset.submitting")
              : t("web.auth.reset.submit")}
          </Button>
        </Form>
      </CardContent>
    </AuthLayout>
  );
}
