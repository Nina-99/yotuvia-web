import { forwardRef } from "react";

import { sanitizeNumberInput, type NumberVariant } from "yotuvia-core";

import { cn } from "@/presentation/lib/cn";

// The variant taxonomy and the keystroke filter live in the core so web and
// mobile filter a field identically; this module only renders it.
export type { NumberVariant };

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
