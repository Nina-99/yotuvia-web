import { useId } from "react";
import type { ReactNode } from "react";
import { Controller, useFormContext } from "react-hook-form";
import type { ControllerRenderProps, FieldError, FieldValues } from "react-hook-form";

import { cn } from "@/presentation/lib/cn";

import { FormError } from "./FormError";

/** Values handed to the render prop so controls stay fully controlled. */
export interface FormFieldRenderArgs {
  field: ControllerRenderProps<FieldValues, string>;
  error: FieldError | undefined;
  invalid: boolean;
  /** Wire the control's `id`/`htmlFor` pair. */
  id: string;
  /** Pass to `aria-describedby`; already points at error/helper ids. */
  describedBy: string | undefined;
}

export interface FormFieldProps {
  name: string;
  label?: ReactNode;
  helperText?: ReactNode;
  className?: string;
  children: (args: FormFieldRenderArgs) => ReactNode;
}

/**
 * Connects a single control to the surrounding `Form` context.
 *
 * Renders an accessible label, wires `aria-invalid`/`aria-describedby` through
 * the render args, and shows the translated error below the control. The
 * render-prop keeps the field typed as `unknown`-free while letting callers use
 * any UI primitive:
 *
 * ```tsx
 * <FormField name="email" label={t("auth.email")}>
 *   {({ field, invalid, describedBy }) => (
 *     <Input {...field} aria-invalid={invalid || undefined} aria-describedby={describedBy} />
 *   )}
 * </FormField>
 * ```
 */
export function FormField({ name, label, helperText, className, children }: FormFieldProps) {
  const { control } = useFormContext();
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const helperId = `${fieldId}-helper`;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const invalid = fieldState.error !== undefined;
        const describedBy =
          [invalid ? errorId : null, helperText != null && !invalid ? helperId : null]
            .filter(Boolean)
            .join(" ") || undefined;

        return (
          <div className={cn("flex flex-col gap-1.5", className)}>
            {label != null ? (
              <label htmlFor={fieldId} className="text-sm font-medium text-text">
                {label}
              </label>
            ) : null}
            {children({ field, error: fieldState.error, invalid, id: fieldId, describedBy })}
            <FormError id={errorId} message={fieldState.error?.message} />
            {helperText != null && !invalid ? (
              <p id={helperId} className="text-xs text-text-muted">
                {helperText}
              </p>
            ) : null}
          </div>
        );
      }}
    />
  );
}
