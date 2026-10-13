import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";

import { ToastProvider } from "@/presentation/components/ui";
import i18n from "@/presentation/i18n";

export interface RenderWithProvidersOptions {
  /** Initial entry for the memory router. */
  route?: string;
}

/**
 * Renders `ui` inside the provider stack the app bootstraps (i18n, React Query,
 * Router, Toasts).
 *
 * Tests keep ownership of `vi.mock("@/di/container")`, so this helper only
 * wires the ambient providers each screen depends on.
 */
export function renderWithProviders(
  ui: ReactElement,
  { route = "/" }: RenderWithProvidersOptions = {},
): RenderResult {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Providers({ children }: { children: ReactNode }) {
    return (
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[route]}>
            <ToastProvider>{children}</ToastProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </I18nextProvider>
    );
  }

  return render(ui, { wrapper: Providers });
}
