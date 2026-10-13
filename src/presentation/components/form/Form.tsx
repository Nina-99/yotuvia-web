import type { FormHTMLAttributes, ReactNode } from "react";
import { FormProvider } from "react-hook-form";
import type { FieldValues, SubmitHandler, UseFormReturn } from "react-hook-form";

export interface FormProps<TFieldValues extends FieldValues>
  extends Omit<FormHTMLAttributes<HTMLFormElement>, "onSubmit"> {
  /** Form instance created by `useZodForm`. */
  form: UseFormReturn<TFieldValues>;
  /** Called only after client-side validation passes. */
  onSubmit: SubmitHandler<TFieldValues>;
  children: ReactNode;
}

/**
 * Provides the react-hook-form context and renders a native `<form>`.
 *
 * `noValidate` disables the browser's own bubbles so validation is always the
 * zod schema's, keeping error copy consistent and translatable.
 */
export function Form<TFieldValues extends FieldValues>({
  form,
  onSubmit,
  children,
  noValidate = true,
  ...rest
}: FormProps<TFieldValues>) {
  return (
    <FormProvider {...form}>
      <form noValidate={noValidate} onSubmit={form.handleSubmit(onSubmit)} {...rest}>
        {children}
      </form>
    </FormProvider>
  );
}
