import { useTranslation } from "react-i18next";

import { cn } from "@/presentation/lib/cn";

export type FormAlertVariant = "error" | "success" | "info";

export interface FormAlertProps {
  /** i18n key (preferred) or literal message; falsy renders nothing. */
  message?: string | null;
  variant?: FormAlertVariant;
}

const variantClasses: Record<FormAlertVariant, string> = {
  error: "border-danger/40 bg-danger/10 text-danger",
  success: "border-success/40 bg-success/10 text-success",
  info: "border-border bg-card2 text-text-muted",
};

/**
 * Form-level alert for failures that are not tied to a single field (invalid
 * credentials, expired tokens, successful submits).
 *
 * `role="alert"` makes it announced by screen readers as soon as it appears,
 * which is why every page renders it unconditionally and lets the message be
 * `null` while there is nothing to say.
 */
export function FormAlert({ message, variant = "error" }: FormAlertProps) {
  const { t } = useTranslation();
  if (!message) return null;

  return (
    <p
      role="alert"
      className={cn("rounded-lg border px-3 py-2 text-sm", variantClasses[variant])}
    >
      {t(message, { defaultValue: message })}
    </p>
  );
}
