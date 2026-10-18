import { forwardRef } from "react";

import { cn } from "@/presentation/lib/cn";

/**
 * Which characters a numeric field may hold.
 *
 *  - `integer` — whole operational values (minutes, steps, counts).
 *  - `decimal` — a canonical number with an optional dot decimal (`12.5`).
 *  - `money`   — an amount read the way the VIEWER typed it.
 */
export type NumberVariant = "integer" | "decimal" | "money";

export interface NumberInputProps {
  id?: string;
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
  className?: string;
  /** Defaults to `integer`. */
  variant?: NumberVariant;
}

const controlClasses =
  "w-full rounded-lg border bg-input px-3 py-2 text-sm text-input-text placeholder:text-input-placeholder transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Keeps only what a value of `variant` can legitimately contain, preserving a
 * leading minus.
 *
 * `money` keeps BOTH `.` and `,` on purpose: the shared `parseAmount` rule reads
 * locale grouping (`1.234,56` AND `1,234.56`), and a native `type="number"`
 * input cannot even accept the comma that rule understands. Everything else is
 * the rule's business — this only stops letters and stray symbols at the
 * keystroke.
 */
function sanitizeNumberInput(raw: string, variant: NumberVariant): string {
  const sign = raw.startsWith("-") ? "-" : "";
  if (variant === "integer") {
    return sign + raw.replace(/[^0-9]/g, "");
  }
  if (variant === "decimal") {
    const digits = raw.replace(/[^0-9.]/g, "");
    const firstDot = digits.indexOf(".");
    const body =
      firstDot === -1
        ? digits
        : `${digits.slice(0, firstDot + 1)}${digits.slice(firstDot + 1).replace(/\./g, "")}`;
    return sign + body;
  }
  return sign + raw.replace(/[^0-9.,]/g, "");
}

/**
 * A numeric control that blocks invalid characters as they are typed.
 *
 * Replaces the plain `type="number"` inputs, which accept `e`, `+`/`-`, and
 * exponent notation, and — crucially — cannot type the locale-separated money
 * that the shared amount rule is built to read.
 */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  {
    id,
    name,
    value,
    onChange,
    onBlur,
    disabled,
    invalid,
    describedBy,
    placeholder,
    className,
    variant = "integer",
  },
  ref,
) {
  const stateClasses = invalid
    ? "border-danger focus:ring-danger"
    : "border-border focus:ring-accent";

  return (
    <input
      ref={ref}
      id={id}
      name={name}
      type="text"
      inputMode={variant === "integer" ? "numeric" : "decimal"}
      value={value ?? ""}
      onChange={(event) => onChange?.(sanitizeNumberInput(event.target.value, variant))}
      onBlur={onBlur}
      disabled={disabled}
      placeholder={placeholder}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={cn(controlClasses, stateClasses, className)}
    />
  );
});
