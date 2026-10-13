import { lazy, Suspense, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import {
  clearOnUnauthorized,
  clearRefreshHandler,
  setOnUnauthorized,
  setRefreshHandler,
} from "yotuvia-core";

import { dependencies } from "@/di/container";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { ROUTES } from "@/presentation/lib/routes";
import {
  CENTER_APP_ROLES,
  CLIENT_APP_ROLES,
  PERSONNEL_APP_ROLES,
  PLATFORM_APP_ROLES,
} from "@/presentation/lib/roles";
import { GuestOnly } from "@/presentation/routes/GuestOnly";
import { RequireAuth } from "@/presentation/routes/RequireAuth";
import { RoleHome } from "@/presentation/routes/RoleHome";
import { RouteFallback } from "@/presentation/routes/route-fallback";
import { useAuthStore } from "@/presentation/stores/use-auth-store";

/**
 * Route-level code splitting.
 *
 * Only the shell is part of the initial bundle: every page below is a dynamic
 * import, so its module graph (and the libraries it alone needs, e.g. `zod` and
 * `react-hook-form` for the form-heavy sections) is fetched when the route is
 * first visited, behind a `Suspense` fallback. The public landing is split the
 * same way, which keeps the entry to the providers + shell while the landing
 * (and the locale chunk it needs) loads in parallel.
 */

/** Authenticated application shell (sidebar + topbar). */
const AppLayout = lazy(() =>
  import("@/presentation/layouts/AppLayout").then((module) => ({
    default: module.AppLayout,
  })),
);

const HomePage = lazy(() =>
  import("@/presentation/pages/HomePage").then((module) => ({
    default: module.HomePage,
  })),
);

const AgendaPage = lazy(() =>
  import("@/presentation/pages/AgendaPage").then((module) => ({
    default: module.AgendaPage,
  })),
);

const ClientsPage = lazy(() =>
  import("@/presentation/pages/ClientsPage").then((module) => ({
    default: module.ClientsPage,
  })),
);

const ContentPage = lazy(() =>
  import("@/presentation/pages/ContentPage").then((module) => ({
    default: module.ContentPage,
  })),
);

const LoyaltyPage = lazy(() =>
  import("@/presentation/pages/LoyaltyPage").then((module) => ({
    default: module.LoyaltyPage,
  })),
);

const PersonnelPage = lazy(() =>
  import("@/presentation/pages/PersonnelPage").then((module) => ({
    default: module.PersonnelPage,
  })),
);

const ProfilePage = lazy(() =>
  import("@/presentation/pages/ProfilePage").then((module) => ({
    default: module.ProfilePage,
  })),
);

const PromotionsPage = lazy(() =>
  import("@/presentation/pages/PromotionsPage").then((module) => ({
    default: module.PromotionsPage,
  })),
);

const ReviewsPage = lazy(() =>
  import("@/presentation/pages/ReviewsPage").then((module) => ({
    default: module.ReviewsPage,
  })),
);

const ServicesPage = lazy(() =>
  import("@/presentation/pages/ServicesPage").then((module) => ({
    default: module.ServicesPage,
  })),
);

const TokensPage = lazy(() =>
  import("@/presentation/pages/TokensPage").then((module) => ({
    default: module.TokensPage,
  })),
);

/**
 * Auth pages load as one shared chunk: a signed-out visitor only opens one of
 * them at a time, but they share the form primitives and schemas, so a single
 * lazily-loaded module avoids per-page duplication.
 */
const LoginPage = lazy(() =>
  import("@/presentation/pages/auth").then((module) => ({ default: module.LoginPage })),
);

const RegisterPage = lazy(() =>
  import("@/presentation/pages/auth").then((module) => ({ default: module.RegisterPage })),
);

const ForgotPasswordPage = lazy(() =>
  import("@/presentation/pages/auth").then((module) => ({
    default: module.ForgotPasswordPage,
  })),
);

const ResetPasswordPage = lazy(() =>
  import("@/presentation/pages/auth").then((module) => ({
    default: module.ResetPasswordPage,
  })),
);

const VerifyEmailPage = lazy(() =>
  import("@/presentation/pages/auth").then((module) => ({
    default: module.VerifyEmailPage,
  })),
);

/**
 * PUBLIC legal pages. Code-split like every other route: a visitor who never
 * opens them pays nothing, and the draft copy stays out of the initial bundle.
 */
const TermsPage = lazy(() =>
  import("@/presentation/pages/legal").then((module) => ({ default: module.TermsPage })),
);

const PrivacyPage = lazy(() =>
  import("@/presentation/pages/legal").then((module) => ({ default: module.PrivacyPage })),
);

/**
 * PUBLIC staff invitation acceptance page (`/join/:token`). Code-split like
 * every other route: a visitor who never opens an invitation pays nothing, and
 * the form-heavy module (zod + react-hook-form) stays out of the entry chunk.
 */
const JoinInvitationPage = lazy(() =>
  import("@/presentation/pages/join").then((module) => ({
    default: module.JoinInvitationPage,
  })),
);

/**
 * Analytics is the only section that pulls `recharts` in (~500 kB minified), so
 * it is code-split instead of inflating the initial bundle every owner pays for
 * on the dashboard. `Suspense` keeps the shell mounted while the chunk loads.
 */
const AnalyticsPage = lazy(() =>
  import("@/presentation/pages/AnalyticsPage").then((module) => ({
    default: module.AnalyticsPage,
  })),
);

/**
 * Platform console pages are code-split for the same reason as analytics: a
 * center owner never renders them, so shipping the two page modules (and the
 * zod/react-hook-form pieces only they use at runtime) in the initial bundle
 * would be dead weight. A platform admin pays one chunk load on first visit to
 * each section.
 */
const PlatformPaymentsPage = lazy(() =>
  import("@/presentation/pages/platform/PlatformPaymentsPage").then((module) => ({
    default: module.PlatformPaymentsPage,
  })),
);

const PlatformCentersPage = lazy(() =>
  import("@/presentation/pages/platform/PlatformCentersPage").then((module) => ({
    default: module.PlatformCentersPage,
  })),
);

/**
 * Client-area pages are code-split for the same reason as the platform console:
 * a center owner or a platform admin never renders them, so shipping the client
 * pages (and `qrcode.react`, which only the reservations page pulls in) in the
 * initial bundle would be dead weight for every other role. `Suspense` keeps the
 * shell mounted while the chunk loads.
 */
const ClientHomePage = lazy(() =>
  import("@/presentation/pages/client/ClientHomePage").then((module) => ({
    default: module.ClientHomePage,
  })),
);

const ClientReservationsPage = lazy(() =>
  import("@/presentation/pages/client/ClientReservationsPage").then((module) => ({
    default: module.ClientReservationsPage,
  })),
);

const ClientFavoritesPage = lazy(() =>
  import("@/presentation/pages/client/ClientFavoritesPage").then((module) => ({
    default: module.ClientFavoritesPage,
  })),
);

const ClientVideosPage = lazy(() =>
  import("@/presentation/pages/client/ClientVideosPage").then((module) => ({
    default: module.ClientVideosPage,
  })),
);

const ClientProfilePage = lazy(() =>
  import("@/presentation/pages/client/ClientProfilePage").then((module) => ({
    default: module.ClientProfilePage,
  })),
);

const ProfessionalProfilePage = lazy(() =>
  import("@/presentation/pages/client/ProfessionalProfilePage").then((module) => ({
    default: module.ProfessionalProfilePage,
  })),
);

/**
 * Staff-area pages are code-split for the same reason as the client area: a
 * staff member is the only role that renders them and the scan page additionally
 * lazy-loads `jsqr` only when the browser lacks `BarcodeDetector`, so neither the
 * pages nor the decoder are dead weight for any other role.
 */
const StaffAgendaPage = lazy(() =>
  import("@/presentation/pages/staff/StaffAgendaPage").then((module) => ({
    default: module.StaffAgendaPage,
  })),
);

const StaffScanPage = lazy(() =>
  import("@/presentation/pages/staff/StaffScanPage").then((module) => ({
    default: module.StaffScanPage,
  })),
);

const StaffProfilePage = lazy(() =>
  import("@/presentation/pages/staff/StaffProfilePage").then((module) => ({
    default: module.StaffProfilePage,
  })),
);

/**
 * Public center surface + the client booking flow.
 *
 * The search and detail pages are PUBLIC (`/centers`, `/centers/:centerId`) and
 * are code-split so a visitor who only reads the landing never downloads them.
 * The booking flow shares the prefix but is CLIENT-only, so it is guarded by its
 * own `RequireAuth` boundary further down (see `AppRouter`).
 */
const CenterSearchPage = lazy(() =>
  import("@/presentation/pages/centers/CenterSearchPage").then((module) => ({
    default: module.CenterSearchPage,
  })),
);

const CenterDetailPage = lazy(() =>
  import("@/presentation/pages/centers/CenterDetailPage").then((module) => ({
    default: module.CenterDetailPage,
  })),
);

const BookingPage = lazy(() =>
  import("@/presentation/pages/centers/BookingPage").then((module) => ({
    default: module.BookingPage,
  })),
);

function NotFoundPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("web.errors.not_found"));
  return (
    <main className="ytv-ambient flex min-h-screen items-center justify-center bg-background text-text">
      <p className="text-lg font-medium">{t("web.errors.not_found")}</p>
    </main>
  );
}

export function AppRouter() {
  // Boot the persisted session once for the whole shell. `hydrate` is
  // idempotent and only runs while the store is still `loading`.
  const hydrate = useAuthStore((state) => state.hydrate);
  const navigate = useNavigate();
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Wire the data layer's two callbacks once at startup (Dependency
  // Inversion: `api-client` never imports the router or Zustand).
  //
  //  - `setRefreshHandler` feeds the 401 interceptor's EXISTING single-flight
  //    rotation (`_triggerRefresh`). Registering here does NOT add a second
  //    rotation path — it supplies the only handler that path consumes; without
  //    it the interceptor's rotation is a silent no-op.
  //  - `setOnUnauthorized` fires only AFTER that rotation already failed (or the
  //    request was already replayed and 401'd again). It clears the session and
  //    sends the user to `/login`, mirroring the interceptor: rotate first,
  //    sign out only when rotation cannot save the session.
  useEffect(() => {
    setOnUnauthorized(() => {
      void useAuthStore.getState().logout();
      navigate(ROUTES.login, { replace: true });
    });
    setRefreshHandler(() => dependencies.authRepository.refresh());

    return () => {
      clearOnUnauthorized();
      clearRefreshHandler();
    };
  }, [navigate]);

  return (
    <Routes>
      <Route
        path={ROUTES.home}
        element={
          <Suspense fallback={<RouteFallback />}>
            <HomePage />
          </Suspense>
        }
      />

      {/*
        PUBLIC center surface. Registered OUTSIDE the authenticated shell on
        purpose: a signed-out visitor must be able to search centers and open a
        center page. Both pages are lazy so the landing stays light.
      */}
      <Route path={ROUTES.centers.search} element={
          <Suspense fallback={<RouteFallback />}>
            <CenterSearchPage />
          </Suspense>
        } />
      <Route path={ROUTES.centers.detail} element={
          <Suspense fallback={<RouteFallback />}>
            <CenterDetailPage />
          </Suspense>
        } />

      <Route element={<GuestOnly />}>
        <Route path={ROUTES.login} element={
            <Suspense fallback={<RouteFallback />}>
              <LoginPage />
            </Suspense>
          } />
        <Route path={ROUTES.register} element={
            <Suspense fallback={<RouteFallback />}>
              <RegisterPage />
            </Suspense>
          } />
      </Route>

      <Route path={ROUTES.forgotPassword} element={
          <Suspense fallback={<RouteFallback />}>
            <ForgotPasswordPage />
          </Suspense>
        } />
      <Route path={ROUTES.resetPassword} element={
          <Suspense fallback={<RouteFallback />}>
            <ResetPasswordPage />
          </Suspense>
        } />
      <Route path={ROUTES.verifyEmail} element={
          <Suspense fallback={<RouteFallback />}>
            <VerifyEmailPage />
          </Suspense>
        } />

      {/*
        PUBLIC legal documents. Registered OUTSIDE every auth boundary: the
        footer and the registration form link here for a signed-out visitor.
      */}
      <Route path={ROUTES.legal.terms} element={
          <Suspense fallback={<RouteFallback />}>
            <TermsPage />
          </Suspense>
        } />
      <Route path={ROUTES.legal.privacy} element={
          <Suspense fallback={<RouteFallback />}>
            <PrivacyPage />
          </Suspense>
        } />

      {/*
        PUBLIC staff invitation acceptance. Registered OUTSIDE every auth
        boundary so an invited professional can open `/join/:token` while signed
        out, exactly like the legal pages.
      */}
      <Route path={ROUTES.join} element={
          <Suspense fallback={<RouteFallback />}>
            <JoinInvitationPage />
          </Suspense>
        } />

      {/*
        The app area only requires an authenticated session. Role gating lives
        INSIDE this shell: center sections are wrapped in a
        `RequireAuth allowedRoles={CENTER_APP_ROLES}` boundary, the platform
        console in `PLATFORM_APP_ROLES`, the client area in `CLIENT_APP_ROLES`,
        the staff area in `PERSONNEL_APP_ROLES`, and the shell root renders
        `RoleHome`, which forwards each role to its own landing path. Every role
        now has a destination, so the layout's "not available for your role"
        state survives only as a defensive fallback.
      */}
      <Route element={<RequireAuth />}>
        <Route
          element={
            <Suspense fallback={<RouteFallback />}>
              <AppLayout />
            </Suspense>
          }
        >
          <Route path={ROUTES.appHome} element={<RoleHome />} />

          <Route element={<RequireAuth allowedRoles={CENTER_APP_ROLES} />}>
            <Route path={ROUTES.app.agenda} element={
                <Suspense fallback={<RouteFallback />}>
                  <AgendaPage />
                </Suspense>
              } />
            <Route path={ROUTES.app.clients} element={
                <Suspense fallback={<RouteFallback />}>
                  <ClientsPage />
                </Suspense>
              } />
            <Route path={ROUTES.app.services} element={
                <Suspense fallback={<RouteFallback />}>
                  <ServicesPage />
                </Suspense>
              } />
            <Route path={ROUTES.app.personnel} element={
                <Suspense fallback={<RouteFallback />}>
                  <PersonnelPage />
                </Suspense>
              } />
            <Route path={ROUTES.app.tokens} element={
                <Suspense fallback={<RouteFallback />}>
                  <TokensPage />
                </Suspense>
              } />
            <Route path={ROUTES.app.loyalty} element={
                <Suspense fallback={<RouteFallback />}>
                  <LoyaltyPage />
                </Suspense>
              } />
            <Route path={ROUTES.app.reviews} element={
                <Suspense fallback={<RouteFallback />}>
                  <ReviewsPage />
                </Suspense>
              } />
            <Route path={ROUTES.app.promotions} element={
                <Suspense fallback={<RouteFallback />}>
                  <PromotionsPage />
                </Suspense>
              } />
            <Route path={ROUTES.app.analytics} element={
                <Suspense fallback={<RouteFallback />}>
                  <AnalyticsPage />
                </Suspense>
              } />
            <Route path={ROUTES.app.content} element={
                <Suspense fallback={<RouteFallback />}>
                  <ContentPage />
                </Suspense>
              } />
            <Route path={ROUTES.app.profile} element={
                <Suspense fallback={<RouteFallback />}>
                  <ProfilePage />
                </Suspense>
              } />
          </Route>

          <Route element={<RequireAuth allowedRoles={PLATFORM_APP_ROLES} />}>
            <Route path={ROUTES.platform.payments} element={
                <Suspense fallback={<RouteFallback />}>
                  <PlatformPaymentsPage />
                </Suspense>
              } />
            <Route path={ROUTES.platform.centers} element={
                <Suspense fallback={<RouteFallback />}>
                  <PlatformCentersPage />
                </Suspense>
              } />
          </Route>

          {/*
            Client area. Its own role boundary, exactly like the platform block:
            a client can only address `/app/client/*` and an owner or platform
            admin hitting one of these paths is sent to its OWN home by
            `RequireAuth`.
          */}
          <Route element={<RequireAuth allowedRoles={CLIENT_APP_ROLES} />}>
            <Route path={ROUTES.client.home} element={
                <Suspense fallback={<RouteFallback />}>
                  <ClientHomePage />
                </Suspense>
              } />
            <Route path={ROUTES.client.reservations} element={
                <Suspense fallback={<RouteFallback />}>
                  <ClientReservationsPage />
                </Suspense>
              } />
            <Route path={ROUTES.client.favorites} element={
                <Suspense fallback={<RouteFallback />}>
                  <ClientFavoritesPage />
                </Suspense>
              } />
            <Route path={ROUTES.client.videos} element={
                <Suspense fallback={<RouteFallback />}>
                  <ClientVideosPage />
                </Suspense>
              } />
            <Route path={ROUTES.client.profile} element={
                <Suspense fallback={<RouteFallback />}>
                  <ClientProfilePage />
                </Suspense>
              } />
            <Route path={ROUTES.client.professional} element={
                <Suspense fallback={<RouteFallback />}>
                  <ProfessionalProfilePage />
                </Suspense>
              } />
          </Route>

          {/*
            Staff area. Its own role boundary, exactly like the platform and
            client blocks: a professional can only address `/app/staff/*` and any
            other role hitting one of these paths is sent to its OWN home by
            `RequireAuth`. `/app/staff` is a landing redirect to the agenda.
          */}
          <Route element={<RequireAuth allowedRoles={PERSONNEL_APP_ROLES} />}>
            <Route path={ROUTES.staff.home} element={<Navigate to={ROUTES.staff.agenda} replace />} />
            <Route path={ROUTES.staff.agenda} element={
                <Suspense fallback={<RouteFallback />}>
                  <StaffAgendaPage />
                </Suspense>
              } />
            <Route path={ROUTES.staff.scan} element={
                <Suspense fallback={<RouteFallback />}>
                  <StaffScanPage />
                </Suspense>
              } />
            <Route path={ROUTES.staff.profile} element={
                <Suspense fallback={<RouteFallback />}>
                  <StaffProfilePage />
                </Suspense>
              } />
          </Route>
        </Route>
      </Route>

      {/*
        CLIENT-only booking flow. It keeps the public `/centers` prefix so the
        "Book" link is a stable, shareable URL, and it renders inside the shared
        authenticated shell (appearance and session handling stay in ONE place).
        A guest who follows the link is sent to `/login` with the booking URL as
        `state.from`, so signing in returns them STRAIGHT to the flow.
      */}
      <Route element={<RequireAuth />}>
        <Route
          element={
            <Suspense fallback={<RouteFallback />}>
              <AppLayout />
            </Suspense>
          }
        >
          <Route element={<RequireAuth allowedRoles={CLIENT_APP_ROLES} />}>
            <Route path={ROUTES.centers.book} element={
                <Suspense fallback={<RouteFallback />}>
                  <BookingPage />
                </Suspense>
              } />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
