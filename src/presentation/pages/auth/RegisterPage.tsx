import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { createReferralByCode } from "yotuvia-core";
import type { AuthResult } from "yotuvia-core";

import { SocialLoginButtons } from "@/presentation/components/auth/SocialLoginButtons";
import { Form, FormAlert, FormField, PhoneInput, useZodForm } from "@/presentation/components/form";
import {
  Button,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Select,
  useToast,
} from "@/presentation/components/ui";
import { useRegister } from "@/presentation/hooks/use-auth";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { AuthLayout } from "@/presentation/layouts/AuthLayout";
import { resolveRedirectPath } from "@/presentation/lib/redirect";
import { ROUTES } from "@/presentation/lib/routes";
import { registrationRoles, registerSchema, toRegisterData } from "@/presentation/schemas/auth.schemas";
import type { RegisterFormValues } from "@/presentation/schemas/auth.schemas";
import { useAuthStore } from "@/presentation/stores/use-auth-store";

const ROLE_LABEL_KEYS: Record<(typeof registrationRoles)[number], string> = {
  CLIENT: "web.auth.roles.client",
  BEAUTY_CENTER: "web.auth.roles.business",
};

/**
 * Self-serve registration for the two public roles.
 *
 * The form mirrors the core `RegisterUserUseCase`: CLIENT accounts require
 * first/last name and phone, BEAUTY_CENTER accounts require a business name and
 * phone. Validation lives in `registerSchema`, so the conditional fields are
 * only validated for the selected role.
 */
export function RegisterPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("web.auth.register.meta.title"));

  const form = useZodForm({
    schema: registerSchema,
    defaultValues: {
      role: "CLIENT",
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      phone: "",
      name: "",
      termsAccepted: false,
    },
  });
  const role = form.watch("role");
  const register = useRegister();
  const setSession = useAuthStore((state) => state.setSession);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const referralCode = (searchParams.get("ref") ?? "").trim().toUpperCase();
  const { toast } = useToast();

  const onSubmit = async (values: RegisterFormValues) => {
    try {
      const result = await register.mutateAsync(toRegisterData(values));
      await handleAuthenticated(result);
    } catch {
      // Handled declaratively through `register.errorKey` below.
    }
  };

  // Shared by the form and social sign-up: registration mints a session too, so
  // it can bump the same cap (rare: a freshly created account normally has none)
  // and honors the destination a guard (or the guest booking CTA) stashed in the
  // location state, exactly like the login page.
  async function handleAuthenticated(result: AuthResult): Promise<void> {
    setSession(result.user);
    // A referral link (/register?ref=CODE) applies the code right after the
    // centre account is created. Best-effort: a stale/invalid code never blocks
    // registration.
    if (referralCode && result.user.role === "BEAUTY_CENTER") {
      try {
        await createReferralByCode({ code: referralCode });
      } catch {
        // Ignored: the code can be entered later from the referrals card.
      }
    }
    if ((result.sessionsEvicted ?? 0) > 0) {
      toast(t("web.auth.register.sessions_evicted"), { variant: "warning" });
    } else {
      toast(t("web.auth.register.success"), { variant: "success" });
    }
    navigate(resolveRedirectPath(location.state), { replace: true });
  }

  return (
    <AuthLayout>
      <CardHeader>
        <CardTitle>{t("web.auth.register.title")}</CardTitle>
        <CardDescription>{t("web.auth.register.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form form={form} onSubmit={onSubmit} className="flex flex-col gap-4">
          <FormField name="role" label={t("web.auth.fields.role")}>
            {({ field, invalid, id, describedBy }) => (
              <Select
                {...field}
                id={id}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              >
                {registrationRoles.map((option) => (
                  <option key={option} value={option}>
                    {t(ROLE_LABEL_KEYS[option])}
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          {role === "CLIENT" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField name="firstName" label={t("web.auth.fields.first_name")}>
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
              <FormField name="lastName" label={t("web.auth.fields.last_name")}>
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
          ) : (
            <FormField name="name" label={t("web.auth.fields.business_name")}>
              {({ field, invalid, id, describedBy }) => (
                <Input
                  {...field}
                  id={id}
                  autoComplete="organization"
                  aria-invalid={invalid || undefined}
                  aria-describedby={describedBy}
                />
              )}
            </FormField>
          )}

          <FormField name="phone" label={t("web.auth.fields.phone")}>
            {({ field, invalid, id, describedBy }) => (
              <PhoneInput {...field} id={id} invalid={invalid} describedBy={describedBy} />
            )}
          </FormField>

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

          <FormField name="termsAccepted">
            {({ field, invalid, id, describedBy }) => (
              <label htmlFor={id} className="flex items-start gap-2 text-sm text-text-muted">
                <input
                  ref={field.ref}
                  id={id}
                  name={field.name}
                  type="checkbox"
                  checked={Boolean(field.value)}
                  onChange={(event) => field.onChange(event.target.checked)}
                  onBlur={field.onBlur}
                  aria-invalid={invalid || undefined}
                  aria-describedby={describedBy}
                  className="mt-0.5 h-4 w-4 rounded border-border text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
                <span>
                  {t("web.auth.register.terms_prefix")}{" "}
                  <Link to={ROUTES.legal.terms} className="font-medium text-link hover:underline">
                    {t("web.auth.register.terms_link")}
                  </Link>{" "}
                  {t("web.auth.register.terms_middle")}{" "}
                  <Link to={ROUTES.legal.privacy} className="font-medium text-link hover:underline">
                    {t("web.auth.register.privacy_link")}
                  </Link>
                </span>
              </label>
            )}
          </FormField>

          <FormAlert message={register.errorKey} />

          <Button type="submit" size="lg" loading={register.isPending} className="w-full">
            {register.isPending
              ? t("web.auth.register.submitting")
              : t("web.auth.register.submit")}
          </Button>
        </Form>

        {/*
          The social door carries the role selected above, so a centre owner can
          never end up with a client account (or vice versa). The component
          derives its note from `accountType`; it renders nothing when no
          provider is configured, keeping the honest degradation.
        */}
        <div className="mt-4">
          <SocialLoginButtons accountType={role} onSuccess={handleAuthenticated} />
        </div>

        <p className="mt-4 text-sm text-text-muted">
          {t("web.auth.register.login_prompt")}{" "}
          <Link
            to={ROUTES.login}
            className="rounded font-semibold text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t("web.auth.register.login_link")}
          </Link>
        </p>
      </CardContent>
    </AuthLayout>
  );
}
