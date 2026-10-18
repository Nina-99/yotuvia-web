import { forwardRef, useId, useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  COUNTRIES,
  DEFAULT_COUNTRY_CODE,
  findCountryByCode,
  stripCountryCode,
  LIMITS,
} from "yotuvia-core";

import { cn } from "@/presentation/lib/cn";

/**
 * Phone control: a dialing-code picker plus a national-number field.
 *
 * The value is the STORED form, `"<code> <national>"` (e.g. `"+591 71234567"`),
 * so it drops straight into any schema governed by the shared `phone()` rule —
 * the same rule mobile validates with. The number field strips anything that is
 * not a digit, a space or a dash on every keystroke, which is what the plain
 * `type="tel"` input never did (on desktop it accepts letters).
 *
 * Fully controlled: country and national part are derived from `value`, so a
 * form reset or an async-loaded profile can never desync the picker.
 */
export interface PhoneInputProps {
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
}

const controlClasses =
  "rounded-lg border bg-input px-3 py-2 text-sm text-input-text placeholder:text-input-placeholder transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60";

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
  { id, name, value, onChange, onBlur, disabled, invalid, describedBy, placeholder, className },
  ref,
) {
  const { t } = useTranslation();
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const defaultCountry = useMemo(
    () => findCountryByCode(DEFAULT_COUNTRY_CODE) ?? COUNTRIES[0],
    [],
  );
  const parsed = useMemo(() => stripCountryCode(value ?? ""), [value]);
  const country = useMemo(
    () =>
      parsed.countryCode
        ? findCountryByCode(parsed.countryCode) ?? defaultCountry
        : defaultCountry,
    [parsed.countryCode, defaultCountry],
  );

  const stateClasses = invalid
    ? "border-danger focus:ring-danger"
    : "border-border focus:ring-accent";

  const handleNumber = (raw: string) => {
    const digits = raw.replace(/[^0-9\s-]/g, "");
    onChange?.(`${country.code} ${digits}`.trimEnd());
  };

  const handleCountry = (code: string) => {
    const next = findCountryByCode(code);
    if (!next) return;
    onChange?.(`${next.code} ${parsed.nationalNumber}`.trimEnd());
  };

  // Keep the composed `"<code> <number>"` inside the stored column's cap.
  const maxLength = Math.max(1, LIMITS.phone.max - country.code.length - 1);

  return (
    <div className={cn("flex gap-2", className)}>
      <select
        aria-label={t("web.forms.phone.country_label")}
        value={country.code}
        onChange={(event) => handleCountry(event.target.value)}
        disabled={disabled}
        className={cn(controlClasses, "w-32 shrink-0", stateClasses)}
      >
        {COUNTRIES.map((c) => (
          <option key={`${c.iso2}-${c.code}`} value={c.code}>
            {c.flag} {c.code}
          </option>
        ))}
      </select>

      <input
        ref={ref}
        id={inputId}
        name={name}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={parsed.nationalNumber}
        onChange={(event) => handleNumber(event.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn(controlClasses, "flex-1", stateClasses)}
      />
    </div>
  );
});
