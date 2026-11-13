import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { createReferralByCode } from "yotuvia-core";
import type { AuthResult } from "yotuvia-core";

import { SocialLoginButtons } from "@/presentation/components/auth/SocialLoginButtons";
import { Form, FormAlert, FormField, PhoneInput, useZodForm } from "@/presentation/components/form";
import { Button, CardContent, CardDescription, CardHeader, CardTitle, Input, useToast } from "@/presentation/components/ui";
import {
  useCompleteRegistration,
  useLogin,
  useRequestLoginCode,
  useVerifyLoginCode,
} from "@/presentation/hooks/use-auth";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { AuthLayout } from "@/presentation/layouts/AuthLayout";
import { resolveRedirectPath } from "@/presentation/lib/redirect";
import { ROUTES } from "@/presentation/lib/routes";
import {
  completeRegistrationSchema,
  loginSchema,
  toCompleteRegistrationData,
  validationKeys,
} from "@/presentation/schemas/auth.schemas";
import type { CompleteRegistrationFormValues } from "@/presentation/schemas/auth.schemas";
import { useAuthStore } from "@/presentation/stores/use-auth-store";

type Step = "email" | "code" | "role" | "details" | "password";

const RESEND_SECONDS = 30;

/**
 * Unified email-first auth for the web.
 *
 * The email proves control with a 6-digit code; an existing account signs in,
 * a new one gets a registration ticket that unlocks the role step. The legacy
 * password form stays reachable behind a secondary link.
 */
export function EmailFirstAuth({ intent = "login" }: { intent?: "login" | "register" }) {
  const { t } = useTranslation();
  useDocumentTitle(
    t(intent === "register" ? "web.auth.register.meta.title" : "web.auth.login.meta.title"),
  );

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const referralCode = (searchParams.get("ref") ?? "").trim().toUpperCase();
  const { toast } = useToast();
  const setSession = useAuthStore((state) => state.setSession);

  const requestCode = useRequestLoginCode();
  const verifyCode = useVerifyLoginCode();
  const completeRegistration = useCompleteRegistration();
  const login = useLogin();

  const linkedEmail = (searchParams.get("email") ?? "").trim();
  const linkedCode = (searchParams.get("code") ?? "").trim();

  const [step, setStep] = useState<Step>(linkedEmail && linkedCode ? "code" : "email");
  const [email, setEmail] = useState(linkedEmail);
  const [code, setCode] = useState(linkedCode);
  const [password, setPassword] = useState("");
  const [registrationTicket, setRegistrationTicket] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const autoVerified = useRef(false);

  const detailsForm = useZodForm({
    schema: completeRegistrationSchema,
    defaultValues: {
      role: "CLIENT",
      firstName: "",
      lastName: "",
      phone: "",
      name: "",
      termsAccepted: false,
    },
  });
  const role = detailsForm.watch("role");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleAuthenticated(result: AuthResult): Promise<void> {
    setSession(result.user);
    if (referralCode && result.user.role === "BEAUTY_CENTER") {
      try {
        await createReferralByCode({ code: referralCode });
      } catch {
        // Best-effort: the code can be entered later.
      }
    }
    if ((result.sessionsEvicted ?? 0) > 0) {
      toast(t("web.auth.login.sessions_evicted"), { variant: "warning" });
    } else {
      toast(t(intent === "register" ? "web.auth.register.success" : "web.auth.login.success"), {
        variant: "success",
      });
    }
    navigate(resolveRedirectPath(location.state), { replace: true });
  }

  const handleRequestCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setStepError(null);
    if (!loginSchema.shape.email.safeParse(email).success) {
      setStepError(t(validationKeys.emailInvalid));
      return;
    }
    try {
      await requestCode.mutateAsync({ email: email.trim() });
      setCooldown(RESEND_SECONDS);
      setStep("code");
    } catch {
      // Handled through `requestCode.errorKey`.
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    try {
      await requestCode.mutateAsync({ email: email.trim() });
      setCooldown(RESEND_SECONDS);
    } catch {
      // Handled through `requestCode.errorKey`.
    }
  };

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    setStepError(null);
    try {
      const result = await verifyCode.mutateAsync({ email: email.trim(), code: code.trim() });
      if (result.kind === "session") {
        await handleAuthenticated(result.session);
        return;
      }
      setRegistrationTicket(result.registrationTicket);
      setStep("role");
    } catch {
      // Handled through `verifyCode.errorKey`.
    }
  };

  const handleDetails = async (values: CompleteRegistrationFormValues) => {
    if (!registrationTicket) {
      setStepError(t("web.auth.email_first.ticket_missing"));
      setStep("email");
      return;
    }
    try {
      const result = await completeRegistration.mutateAsync(
        toCompleteRegistrationData(values, registrationTicket),
      );
      await handleAuthenticated(result);
    } catch {
      // Handled through `completeRegistration.errorKey`.
    }
  };

  const handlePasswordLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setStepError(null);
    if (password.length < 8) {
      setStepError(t(validationKeys.passwordMin));
      return;
    }
    try {
      await handleAuthenticated(await login.mutateAsync({ email: email.trim(), password }));
    } catch {
      // Handled through `login.errorKey`.
    }
  };

  const goBackToEmail = () => {
    setCode("");
    setStep("email");
  };

  // Magic link: a URL carrying email + code verifies automatically. Possession
  // of the emailed link proves control of the address, and the guard keeps it to
  // one attempt per mount. On failure the code step stays usable for a retry.
  useEffect(() => {
    if (autoVerified.current) return;
    if (!linkedEmail || !linkedCode) return;
    autoVerified.current = true;

    void (async () => {
      try {
        const result = await verifyCode.mutateAsync({
          email: linkedEmail,
          code: linkedCode,
        });
        if (result.kind === "session") {
          await handleAuthenticated(result.session);
          return;
        }
        setRegistrationTicket(result.registrationTicket);
        setStep("role");
      } catch {
        // `verifyCode.errorKey` surfaces on the code step.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot guard
  }, [linkedEmail, linkedCode]);

  return (
    <AuthLayout>
      <CardHeader>
        <CardTitle>
          {step === "details"
            ? t("web.auth.email_first.details_title")
            : step === "role"
              ? t("web.auth.email_first.role_title")
              : t(intent === "register" ? "web.auth.register.title" : "web.auth.login.title")}
        </CardTitle>
        <CardDescription>
          {step === "email"
            ? t(
                intent === "register"
                  ? "web.auth.email_first.register_subtitle"
                  : "web.auth.email_first.subtitle",
              )
            : t(intent === "register" ? "web.auth.register.subtitle" : "web.auth.login.subtitle")}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {step === "email" && (
          <>
            <form onSubmit={handleRequestCode} noValidate className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="auth-email" className="text-sm font-medium">
                  {t("web.auth.fields.email")}
                </label>
                <Input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  placeholder={t("web.auth.fields.email_placeholder")}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              {stepError && <p className="text-sm text-danger">{stepError}</p>}
              <FormAlert message={requestCode.errorKey} />

              <Button type="submit" size="lg" loading={requestCode.isPending} className="w-full">
                {t("web.auth.email_first.continue")}
              </Button>
            </form>

            <button
              type="button"
              onClick={() => setStep("password")}
              className="self-start rounded text-sm font-medium text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t("web.auth.email_first.use_password")}
            </button>

            <SocialLoginButtons
              noteKey="web.auth.social.login_note"
              onSuccess={handleAuthenticated}
            />
          </>
        )}

        {step === "code" && (
          <>
            <form onSubmit={handleVerify} noValidate className="flex flex-col gap-4">
              <p className="text-sm text-text-muted">
                {t("web.auth.email_first.code_sent", { email: email.trim() })}
              </p>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="auth-code" className="text-sm font-medium">
                  {t("web.auth.email_first.code_label")}
                </label>
                <Input
                  id="auth-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                />
              </div>

              <FormAlert message={verifyCode.errorKey} />

              <Button
                type="submit"
                size="lg"
                loading={verifyCode.isPending}
                disabled={code.trim().length !== 6}
                className="w-full"
              >
                {t("web.auth.email_first.verify")}
              </Button>
            </form>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0 || requestCode.isPending}
                className="rounded font-medium text-link hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {cooldown > 0
                  ? t("web.auth.email_first.resend_in", { seconds: cooldown })
                  : t("web.auth.email_first.resend")}
              </button>
              <button
                type="button"
                onClick={goBackToEmail}
                className="rounded font-medium text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {t("web.auth.email_first.change_email")}
              </button>
            </div>
          </>
        )}

        {step === "password" && (
          <>
            <form onSubmit={handlePasswordLogin} noValidate className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="auth-password-email" className="text-sm font-medium">
                  {t("web.auth.fields.email")}
                </label>
                <Input
                  id="auth-password-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="auth-password" className="text-sm font-medium">
                  {t("web.auth.fields.password")}
                </label>
                <Input
                  id="auth-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>

              {stepError && <p className="text-sm text-danger">{stepError}</p>}
              <FormAlert message={login.errorKey} />

              <Button type="submit" size="lg" loading={login.isPending} className="w-full">
                {t("web.auth.login.submit")}
              </Button>
            </form>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <Link to={ROUTES.forgotPassword} className="font-medium text-link hover:underline">
                {t("web.auth.login.forgot_link")}
              </Link>
              <button
                type="button"
                onClick={goBackToEmail}
                className="rounded font-medium text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {t("web.auth.email_first.change_email")}
              </button>
            </div>
          </>
        )}

        {step === "role" && (
          <div className="flex flex-col gap-3">
            {(["CLIENT", "BEAUTY_CENTER"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  detailsForm.setValue("role", option);
                  setStep("details");
                }}
                className="rounded-lg border border-border p-4 text-left hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="block font-semibold">
                  {t(option === "CLIENT" ? "web.auth.roles.client" : "web.auth.roles.business")}
                </span>
              </button>
            ))}
          </div>
        )}

        {step === "details" && (
          <Form form={detailsForm} onSubmit={handleDetails} className="flex flex-col gap-4">
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

            <FormAlert message={completeRegistration.errorKey} />

            <Button
              type="submit"
              size="lg"
              loading={completeRegistration.isPending}
              className="w-full"
            >
              {t("web.auth.register.submit")}
            </Button>

            <SocialLoginButtons accountType={role} onSuccess={handleAuthenticated} />
          </Form>
        )}
      </CardContent>
    </AuthLayout>
  );
}
