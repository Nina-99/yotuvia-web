import { forwardRef, useId } from "react";
import type { ReactNode, SelectHTMLAttributes } from "react";

import { cn } from "@/presentation/lib/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  error?: string;
  helperText?: string;
  children: ReactNode;
}

const controlClasses =
  "w-full rounded-lg border bg-input px-3 py-2 text-sm text-input-text transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60";

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, helperText, id, className, children, ...rest },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = `${selectId}-error`;
  const helperId = `${selectId}-helper`;
  const describedBy = [error ? errorId : null, helperText && !error ? helperId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={selectId} className="text-sm font-medium text-text">
          {label}
        </label>
      ) : null}
      <select
        ref={ref}
        id={selectId}
        className={cn(
          controlClasses,
          error ? "border-danger focus:ring-danger" : "border-border focus:ring-accent",
          className,
        )}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...rest}
      >
        {children}
      </select>
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
      {helperText && !error ? (
        <p id={helperId} className="text-xs text-text-muted">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});
