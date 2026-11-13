import { EmailFirstAuth } from "./EmailFirstAuth";

/**
 * `/register` — same unified flow as `/login`, with register-oriented copy.
 * Kept as its own route so referral links (`/register?ref=CODE`) and existing
 * inbound links keep working.
 */
export function RegisterPage() {
  return <EmailFirstAuth intent="register" />;
}
