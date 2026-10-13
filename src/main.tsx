import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import i18n, { DEFAULT_LANGUAGE, i18nReady } from '@/presentation/i18n'
import { ToastProvider } from '@/presentation/components/ui'
import { queryClient } from '@/presentation/lib/query-client'
import { applyDarkTheme } from '@/presentation/lib/dark-theme'
import App from './App.tsx'

// Dark-only shell: re-assert the theme before the first render.
applyDarkTheme()

/**
 * Boot the shell only after the active locale is ready.
 *
 * The default locale is bundled, so this resolves immediately for `es`. A
 * persisted non-default locale (`en`) is fetched as a lazy chunk here, before
 * the first render, so the UI never flashes raw translation keys.
 */
async function bootstrap(): Promise<void> {
  await i18nReady.catch(() => undefined)

  // Defensive: if the lazy locale chunk failed to load, fall back to the
  // bundled default instead of rendering raw keys.
  const active = i18n.resolvedLanguage ?? i18n.language
  if (!i18n.hasResourceBundle(active, 'translation')) {
    await i18n.changeLanguage(DEFAULT_LANGUAGE)
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <ToastProvider>
              <App />
            </ToastProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </I18nextProvider>
    </StrictMode>,
  )
}

void bootstrap()
