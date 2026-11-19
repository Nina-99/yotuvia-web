export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const baseClasses = [
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold",
  "ytv-hover-glow",
  "transition-colors focus-visible:outline-none focus-visible:ring-2",
  "focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "disabled:pointer-events-none disabled:opacity-50",
].join(" ");

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent/90",
  secondary: "border border-border bg-card2 text-text hover:bg-badge",
  outline: "border border-border bg-transparent text-text hover:bg-card2",
  ghost: "bg-transparent text-text hover:bg-card2",
  danger: "bg-danger text-white hover:bg-danger/90",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export interface ButtonClassOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/**
 * Shared button classes, also usable on non-`<button>` elements (e.g. a
 * react-router `<Link>` rendered as a primary CTA) without nesting
 * interactive elements.
 */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: ButtonClassOptions = {}): string {
  return [baseClasses, variantClasses[variant], sizeClasses[size], className]
    .filter(Boolean)
    .join(" ");
}
