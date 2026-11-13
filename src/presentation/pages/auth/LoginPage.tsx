import { EmailFirstAuth } from "./EmailFirstAuth";

/**
 * `/login` — unified email-first entry point. Signing in and creating an
 * account share the same screen; the backend decides which branch applies
 * without ever revealing whether the email exists.
 */
export function LoginPage() {
  return <EmailFirstAuth intent="login" />;
}
