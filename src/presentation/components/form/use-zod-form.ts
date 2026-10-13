import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { FieldValues, UseFormProps, UseFormReturn } from "react-hook-form";
import type { ZodType } from "zod";

/**
 * Zod-backed form schema.
 *
 * Both generics are pinned to the same shape because the resolver validates
 * the form values in place (no input/output transform), which keeps
 * `useZodForm` assignable to `UseFormReturn<TFieldValues>` without casts.
 */
export type ZodFormSchema<TFieldValues extends FieldValues> = ZodType<
  TFieldValues,
  TFieldValues
>;

export interface UseZodFormOptions<TFieldValues extends FieldValues>
  extends Omit<UseFormProps<TFieldValues, unknown, TFieldValues>, "resolver"> {
  schema: ZodFormSchema<TFieldValues>;
}

/**
 * `useForm` pre-wired with `zodResolver`.
 *
 * Usage:
 * ```ts
 * const form = useZodForm({ schema: loginSchema, defaultValues: { email: "", password: "" } })
 * ```
 */
export function useZodForm<TFieldValues extends FieldValues>(
  options: UseZodFormOptions<TFieldValues>,
): UseFormReturn<TFieldValues> {
  const { schema, ...formOptions } = options;
  return useForm<TFieldValues>({
    ...formOptions,
    resolver: zodResolver(schema),
  });
}
