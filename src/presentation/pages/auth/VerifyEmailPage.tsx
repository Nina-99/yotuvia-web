import { useCallback, useEffect, useRef, useState } from "react";
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
import { useResendVerification, useVerifyEmail } from "@/presentation/hooks/use-auth";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { AuthLayout } from "@/presentation/layouts/AuthLayout";
import { getErrorStatus, toErrorKey } from "@/presentation/lib/errors";
import { ROUTES } from "@/presentation/lib/routes";
import { forgotPasswordSchema } from "@/presentation/schemas/auth.schemas";
import type { ForgotPasswordFormValues } from "@/presentation/schemas/auth.schemas";

type VerifyState = "loading" | "success" | "invalid" | "error";

const VERIFY_ERROR_FALLBACK = "errors.auth_verify_email";

/**
 * Redeems an email-verification token from the URL query on mount.
 *
 * A rejected token (400) shows the expired/already-used state together with the
 * resend form: the visitor proved they can receive mail at that address, and a
 * resend entry point on the recovery page would conflate two different intents.
 */
export function VerifyEmailPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("web.auth.verify.meta.title"));

  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [state, setState] = useState<VerifyState>(() => (token ? "loading" : "invalid"));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendSent, setResendSent] = useState(false);

  const verifyEmail = useVerifyEmail();
  const resendVerification = useResendVerification();
  const resendForm = useZodForm({
    schema: forgotPasswordSchema,
    defaultValues: { email: "" },
  });

  const runVerification = useCallback(async () => {
    if (!token) {
      setState("invalid");
      return;
    }

    setState("loading");
    setErrorMessage(null);

    try {
      await verifyEmail.mutateAsync({ token });
      setState("success");
    } catch (error) {
      if (getErrorStatus(error) === 400) {
        setState("invalid");
        return;
      }
      setErrorMessage(toErrorKey(error, VERIFY_ERROR_FALLBACK));
      setState("error");
    }
  }, [token, verifyEmail]);

  // Consume the token exactly once on mount (StrictMode runs effects twice).
  const ranRef = useRef(false);
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    void runVerification();
  }, [runVerification]);

  const onResend = async (values: ForgotPasswordFormValues) => {
    try {
      await resendVerification.mutateAsync(values);
      setResendSent(true);
    } catch {
      // Handled declaratively through `resendVerification.errorKey` below.
    }
  };

  const loginLink = (
    <Link
      to={ROUTES.login}
      className="rounded text-center text-sm font-semibold text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {t("web.auth.verify.go_to_login")}
    </Link>
  );

  return (
    <AuthLayout>
      <CardHeader>
        <CardTitle>{t("web.auth.verify.title")}</CardTitle>
        {state === "success" ? (
          <CardDescription>{t("web.auth.verify.success_message")}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {state === "loading" ? (
          <p role="status" aria-live="polite" className="text-sm text-text-muted">
            {t("web.auth.verify.loading")}
          </p>
        ) : null}

        {state === "success" ? loginLink : null}

        {state === "invalid" ? (
          <>
            <FormAlert message={t("web.auth.verify.invalid_message")} />
            {resendSent ? (
              <FormAlert variant="success" message={t("web.auth.verify.resend_sent")} />
            ) : (
              <>
                <p className="text-sm text-text-muted">{t("web.auth.verify.resend_title")}</p>
                <Form form={resendForm} onSubmit={onResend} className="flex flex-col gap-4">
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

                  <FormAlert message={resendVerification.errorKey} />

                  <Button
                    type="submit"
                    size="lg"
                    loading={resendVerification.isPending}
                    className="w-full"
                  >
                    {t("web.auth.verify.resend_submit")}
                  </Button>
                </Form>
              </>
            )}
            {loginLink}
          </>
        ) : null}

        {state === "error" ? (
          <>
            <FormAlert message={errorMessage} />
            <Button
              size="lg"
              className="w-full"
              loading={verifyEmail.isPending}
              onClick={() => void runVerification()}
            >
              {t("web.auth.verify.retry")}
            </Button>
            {loginLink}
          </>
        ) : null}
      </CardContent>
    </AuthLayout>
  );
}
