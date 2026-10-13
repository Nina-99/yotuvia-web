import { createContext } from "react";

export type ToastVariant = "default" | "success" | "error" | "warning" | "info";

export interface ToastOptions {
  variant?: ToastVariant;
  /** Auto-dismiss delay in ms. Use 0 to keep the toast until dismissed. */
  duration?: number;
}

export interface ToastRecord {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
}

export interface ToastContextValue {
  toasts: ToastRecord[];
  toast: (message: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);
