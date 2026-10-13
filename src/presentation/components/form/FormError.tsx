import { useTranslation } from "react-i18next";

export interface FormErrorProps {
  /** id referenced by the control's `aria-describedby`. */
  id?: string;
  /** i18n key (preferred) or literal message; falsy renders nothing. */
  message?: string;
}

/**
 * Accessible inline error text.
 *
 * Messages produced by the auth schemas are i18n keys, so they are translated
 * here; a literal message still renders via `defaultValue`.
 */
export function FormError({ id, message }: FormErrorProps) {
  const { t } = useTranslation();
  if (!message) return null;

  return (
    <p id={id} role="alert" className="text-xs text-danger">
      {t(message, { defaultValue: message })}
    </p>
  );
}
