export type ClassValue = string | number | false | null | undefined

/**
 * Minimal class-name joiner. Keeps the UI primitives dependency-free while
 * allowing conditional classes without string concatenation noise.
 */
export function cn(...values: ClassValue[]): string {
  return values.filter((value): value is string | number => Boolean(value)).join(" ")
}
