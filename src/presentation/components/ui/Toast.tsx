import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/presentation/lib/cn";

import { ToastContext } from "./toast-context";
import type { ToastOptions, ToastRecord, ToastVariant } from "./toast-context";

const DEFAULT_DURATION = 4000;

const variantClasses: Record<ToastVariant, string> = {
  default: "border-border",
  success: "border-success/40",
  error: "border-danger/40",
  warning: "border-warning/40",
  info: "border-info/40",
};

function createId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const id = createId();
      const record: ToastRecord = {
        id,
        message,
        variant: options.variant ?? "default",
        duration: options.duration ?? DEFAULT_DURATION,
      };
      setToasts((current) => [...current, record]);
      if (record.duration > 0) {
        window.setTimeout(() => dismiss(id), record.duration);
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toasts, toast, dismiss }), [toasts, toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-lg border bg-card px-4 py-3 text-sm text-text shadow-lg",
              variantClasses[item.variant],
            )}
          >
            <p className="flex-1">{item.message}</p>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label={t("web.layout.dismiss")}
              className="rounded-md p-0.5 text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
