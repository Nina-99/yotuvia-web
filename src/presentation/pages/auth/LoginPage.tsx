import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { AuthResult } from "yotuvia-core";

import { SocialLoginButtons } from "@/presentation/components/auth/SocialLoginButtons";
import { Form, FormAlert, FormField, useZodForm } from "@/presentation/components/form";
import { Button, CardContent, CardDescription, CardHeader, CardTitle, Input, useToast } from "@/presentation/components/ui";
import { useLogin } from "@/presentation/hooks/use-auth";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { AuthLayout } from "@/presentation/layouts/AuthLayout";
import { resolveRedirectPath } from "@/presentation/lib/redirect";
import { ROUTES } from "@/presentation/lib/routes";
import { loginSchema } from "@/presentation/schemas/auth.schemas";
import type { LoginFormValues } from "@/presentation/schemas/auth.schemas";
import { useAuthStore } from "@/presentation/stores/use-auth-store";

/**
 * Email/password sign-in.
 *
 * On success the session is committed to the store and the visitor is sent to
 * the destination the route guard stashed in the location state (or the app
 * home). Failures surface through the mutation's `errorKey`, already mapped to
 * an i18n key by `attachErrorKey`.
 */
export function LoginPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("web.auth.login.meta.title"));

  const form = useZodForm({
    schema: loginSchema,
    defaultValues: { email: "", password: "" },
  });
  const login = useLogin();
  const setSession = useAuthStore((state) => state.setSession);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const onSubmit = async (values: LoginFormValues) => {
    try {
      const result = await login.mutateAsync(values);
      await handleAuthenticated(result);
    } catch {
      // Handled declaratively through `login.errorKey` below.
    }
  };

  // Shared by the password form and social sign-in: both return the same auth
  // payload, so both commit the session, warn on eviction and honor the
  // destination a route guard stashed in `state.from`.
  async function handleAuthenticated(result: AuthResult): Promise<void> {
    setSession(result.user);
    // The cap revoked older sessions on the server: tell the user which device
    // was signed out instead of the plain success message. The toast provider
    // sits above the routes, so the warning survives the redirect below.
    if ((result.sessionsEvicted ?? 0) > 0) {
      toast(t("web.auth.login.sessions_evicted"), { variant: "warning" });
    } else {
      toast(t("web.auth.login.success"), { variant: "success" });
    }
    navigate(resolveRedirectPath(location.state), { replace: true });
  }

  return (
    <AuthLayout>
      <CardHeader>
        <CardTitle>{t("web.auth.login.title")}</CardTitle>
        <CardDescription>{t("web.auth.login.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
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

          <FormField name="password" label={t("web.auth.fields.password")}>
            {({ field, invalid, id, describedBy }) => (
              <Input
                {...field}
                id={id}
                type="password"
                autoComplete="current-password"
                placeholder={t("web.auth.fields.password_placeholder")}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              />
            )}
          </FormField>

          <FormAlert message={login.errorKey} />

          <Button type="submit" size="lg" loading={login.isPending} className="w-full">
            {login.isPending ? t("web.auth.login.submitting") : t("web.auth.login.submit")}
          </Button>
        </Form>

        <SocialLoginButtons noteKey="web.auth.social.login_note" onSuccess={handleAuthenticated} />

        <div className="flex flex-col gap-2 text-sm">
          <Link
            to={ROUTES.forgotPassword}
            className="rounded font-medium text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t("web.auth.login.forgot_link")}
          </Link>
          <p className="text-text-muted">
            {t("web.auth.login.register_prompt")}{" "}
            <Link
              to={ROUTES.register}
              className="rounded font-semibold text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t("web.auth.login.register_link")}
            </Link>
          </p>
        </div>
      </CardContent>
    </AuthLayout>
  );
}
