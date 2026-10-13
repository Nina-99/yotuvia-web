import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Form, FormAlert, FormField, useZodForm } from "@/presentation/components/form";
import {
  Button,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@/presentation/components/ui";
import { useForgotPassword } from "@/presentation/hooks/use-auth";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { AuthLayout } from "@/presentation/layouts/AuthLayout";
import { ROUTES } from "@/presentation/lib/routes";
import { forgotPasswordSchema } from "@/presentation/schemas/auth.schemas";
import type { ForgotPasswordFormValues } from "@/presentation/schemas/auth.schemas";

/**
 * Requests a password-recovery email.
 *
 * The backend answers 200 for every well-formed address, so the success state
 * is deliberately neutral: it must never reveal whether the account exists.
 */
export function ForgotPasswordPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("web.auth.forgot.meta.title"));

  const form = useZodForm({
    schema: forgotPasswordSchema,
    defaultValues: { email: "" },
  });
  const forgotPassword = useForgotPassword();
  const [sent, setSent] = useState(false);

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    try {
      await forgotPassword.mutateAsync(values);
      setSent(true);
    } catch {
      // Handled declaratively through `forgotPassword.errorKey` below.
    }
  };

  return (
    <AuthLayout>
      <CardHeader>
        <CardTitle>{t("web.auth.forgot.title")}</CardTitle>
        <CardDescription>{t("web.auth.forgot.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {sent ? (
          <>
            <FormAlert variant="success" message={t("web.auth.forgot.sent_message")} />
            <Link
              to={ROUTES.login}
              className="rounded text-center text-sm font-semibold text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t("web.auth.forgot.back_to_login")}
            </Link>
          </>
        ) : (
          <>
            <Form form={form} onSubmit={onSubmit} className="flex flex-col gap-4">
              <FormField name="email" label={t("web.auth.fields.email")}>
                {({ field, invalid, id, describedBy }) => (
                  <Input
                    {...field}
                    id={id}
                    type="email"
                    autoComplete="email"
                    placeholder={t("web.auth.fields.email_placeholder")}
                    aria-invalid={invalid || undefined}
                    aria-describedby={describedBy}
                  />
                )}
              </FormField>

              <FormAlert message={forgotPassword.errorKey} />

              <Button
                type="submit"
                size="lg"
                loading={forgotPassword.isPending}
                className="w-full"
              >
                {forgotPassword.isPending
                  ? t("web.auth.forgot.submitting")
                  : t("web.auth.forgot.submit")}
              </Button>
            </Form>

            <Link
              to={ROUTES.login}
              className="rounded text-center text-sm font-semibold text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t("web.auth.forgot.back_to_login")}
            </Link>
          </>
        )}
      </CardContent>
    </AuthLayout>
  );
}
