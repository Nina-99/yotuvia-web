import { screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  loginExecute: vi.fn(),
  registerExecute: vi.fn(),
  forgotExecute: vi.fn(),
  resetExecute: vi.fn(),
  verifyExecute: vi.fn(),
  resendExecute: vi.fn(),
  socialExecute: vi.fn(),
  logoutAllExecute: vi.fn(),
  authRepository: {
    getCurrentUser: vi.fn(),
    isAuthenticated: vi.fn(),
    getAccessToken: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  },
}));

vi.mock("@/di/container", () => ({
  dependencies: { authRepository: mocks.authRepository },
  forgotPasswordUseCase: { execute: mocks.forgotExecute },
  loginUserUseCase: { execute: mocks.loginExecute },
  logoutAllUseCase: { execute: mocks.logoutAllExecute },
  registerUserUseCase: { execute: mocks.registerExecute },
  resendVerificationUseCase: { execute: mocks.resendExecute },
  resetPasswordUseCase: { execute: mocks.resetExecute },
  socialLoginUseCase: { execute: mocks.socialExecute },
  verifyEmailUseCase: { execute: mocks.verifyExecute },
}));

import i18n from "@/presentation/i18n";
import { ROUTES } from "@/presentation/lib/routes";
import {
  CENTER_APP_ROLES,
  CLIENT_APP_ROLES,
  PERSONNEL_APP_ROLES,
} from "@/presentation/lib/roles";
import { GuestOnly } from "@/presentation/routes/GuestOnly";
import { RequireAuth } from "@/presentation/routes/RequireAuth";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import type { AuthSessionState } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

const USER: User = {
  id: "user-1",
  firstName: "Ana",
  lastName: "Díaz",
  email: "ana@example.com",
  role: "CLIENT",
};

type SessionSlice = Pick<
  AuthSessionState,
  "user" | "role" | "status" | "isAuthenticated"
>;

const UNAUTHENTICATED: SessionSlice = {
  user: null,
  role: null,
  status: "unauthenticated",
  isAuthenticated: false,
};

const AUTHENTICATED_CLIENT: SessionSlice = {
  user: USER,
  role: "CLIENT",
  status: "authenticated",
  isAuthenticated: true,
};

const AUTHENTICATED_PERSONNEL: SessionSlice = {
  user: { ...USER, id: "5", role: "PERSONNEL" },
  role: "PERSONNEL",
  status: "authenticated",
  isAuthenticated: true,
};

function LoginProbe() {
  const location = useLocation();
  const state = location.state as { from?: { pathname?: string } } | null;
  return <div>{`login screen from ${state?.from?.pathname ?? "none"}`}</div>;
}

function RequireAuthTree() {
  return (
    <Routes>
      <Route path={ROUTES.login} element={<LoginProbe />} />
      <Route element={<RequireAuth />}>
        <Route path={ROUTES.appHome} element={<div>private home</div>} />
      </Route>
    </Routes>
  );
}

function RoleGuardedTree() {
  return (
    <Routes>
      <Route path={ROUTES.appHome} element={<div>app home</div>} />
      <Route path={ROUTES.staff.home} element={<div>staff home</div>} />
      <Route element={<RequireAuth allowedRoles={["BEAUTY_CENTER"]} />}>
        <Route path="/admin" element={<div>admin area</div>} />
      </Route>
    </Routes>
  );
}

function GuestTree() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path={ROUTES.login} element={<div>login form</div>} />
      </Route>
      <Route path={ROUTES.appHome} element={<div>app home</div>} />
    </Routes>
  );
}

/**
 * Mirrors the production boundaries: the shell root, the center block behind
 * `CENTER_APP_ROLES`, the client block behind `CLIENT_APP_ROLES` and the staff
 * block behind `PERSONNEL_APP_ROLES`.
 */
function BoundaryTree() {
  return (
    <Routes>
      <Route path={ROUTES.appHome} element={<div>app home</div>} />
      <Route path={ROUTES.client.home} element={<div>client home</div>} />
      <Route path={ROUTES.staff.home} element={<div>staff home</div>} />
      <Route element={<RequireAuth allowedRoles={CENTER_APP_ROLES} />}>
        <Route path={ROUTES.app.agenda} element={<div>agenda area</div>} />
      </Route>
      <Route element={<RequireAuth allowedRoles={CLIENT_APP_ROLES} />}>
        <Route path={ROUTES.client.reservations} element={<div>my reservations</div>} />
      </Route>
      <Route element={<RequireAuth allowedRoles={PERSONNEL_APP_ROLES} />}>
        <Route path={ROUTES.staff.agenda} element={<div>staff agenda</div>} />
      </Route>
    </Routes>
  );
}

function renderAt(element: ReactElement, route: string) {
  return renderWithProviders(element, { route });
}

describe("RequireAuth", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authRepository.getCurrentUser.mockResolvedValue(null);
    mocks.authRepository.isAuthenticated.mockResolvedValue(false);
    useAuthStore.setState({ ...UNAUTHENTICATED });
  });

  it("redirects unauthenticated visitors to /login preserving the destination", async () => {
    useAuthStore.setState({ ...UNAUTHENTICATED });
    renderAt(<RequireAuthTree />, ROUTES.appHome);

    expect(await screen.findByText("login screen from /app")).toBeInTheDocument();
    expect(screen.queryByText("private home")).not.toBeInTheDocument();
  });

  it("renders the protected content for an authenticated session", async () => {
    mocks.authRepository.getCurrentUser.mockResolvedValue(USER);
    mocks.authRepository.isAuthenticated.mockResolvedValue(true);
    useAuthStore.setState({ ...AUTHENTICATED_CLIENT });

    renderAt(<RequireAuthTree />, ROUTES.appHome);

    expect(await screen.findByText("private home")).toBeInTheDocument();
  });

  it("sends a session without the required role to its OWN home", async () => {
    mocks.authRepository.getCurrentUser.mockResolvedValue(USER);
    mocks.authRepository.isAuthenticated.mockResolvedValue(true);
    // A staff member now has a surface of its own, so its home is /app/staff.
    useAuthStore.setState({ ...AUTHENTICATED_PERSONNEL });

    renderAt(<RoleGuardedTree />, "/admin");

    expect(await screen.findByText("staff home")).toBeInTheDocument();
    expect(screen.queryByText("admin area")).not.toBeInTheDocument();
    expect(screen.queryByText("app home")).not.toBeInTheDocument();
  });

  it("shows the loading fallback while the session is hydrating", () => {
    mocks.authRepository.getCurrentUser.mockReturnValue(new Promise<User | null>(() => undefined));
    mocks.authRepository.isAuthenticated.mockReturnValue(new Promise<boolean>(() => undefined));
    useAuthStore.setState({ ...UNAUTHENTICATED, status: "loading" });

    renderAt(<RequireAuthTree />, ROUTES.appHome);

    expect(screen.getByLabelText("Loading...")).toBeInTheDocument();
  });
});

describe("RequireAuth role boundaries (client vs center)", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authRepository.getCurrentUser.mockResolvedValue(USER);
    mocks.authRepository.isAuthenticated.mockResolvedValue(true);
    useAuthStore.setState({ ...AUTHENTICATED_CLIENT });
  });

  it("lets a client into the client area", async () => {
    renderAt(<BoundaryTree />, ROUTES.client.reservations);

    expect(await screen.findByText("my reservations")).toBeInTheDocument();
  });

  it("sends a client away from a center section, to its OWN home", async () => {
    renderAt(<BoundaryTree />, ROUTES.app.agenda);

    expect(await screen.findByText("client home")).toBeInTheDocument();
    expect(screen.queryByText("agenda area")).not.toBeInTheDocument();
    expect(screen.queryByText("app home")).not.toBeInTheDocument();
  });

  it("sends a center owner away from the client area, to the shell root", async () => {
    const owner: User = { ...USER, id: "7", role: "BEAUTY_CENTER" };
    useAuthStore.setState({
      user: owner,
      role: "BEAUTY_CENTER",
      status: "authenticated",
      isAuthenticated: true,
    });

    renderAt(<BoundaryTree />, ROUTES.client.reservations);

    expect(await screen.findByText("app home")).toBeInTheDocument();
    expect(screen.queryByText("my reservations")).not.toBeInTheDocument();
  });

  it("lets a center owner into a center section", async () => {
    const owner: User = { ...USER, id: "7", role: "BEAUTY_CENTER" };
    useAuthStore.setState({
      user: owner,
      role: "BEAUTY_CENTER",
      status: "authenticated",
      isAuthenticated: true,
    });

    renderAt(<BoundaryTree />, ROUTES.app.agenda);

    expect(await screen.findByText("agenda area")).toBeInTheDocument();
  });

  it("lets a staff member into the staff area", async () => {
    useAuthStore.setState({ ...AUTHENTICATED_PERSONNEL });

    renderAt(<BoundaryTree />, ROUTES.staff.agenda);

    expect(await screen.findByText("staff agenda")).toBeInTheDocument();
  });

  it("sends a staff member away from the client area, to its OWN home", async () => {
    useAuthStore.setState({ ...AUTHENTICATED_PERSONNEL });

    renderAt(<BoundaryTree />, ROUTES.client.reservations);

    expect(await screen.findByText("staff home")).toBeInTheDocument();
    expect(screen.queryByText("my reservations")).not.toBeInTheDocument();
    expect(screen.queryByText("app home")).not.toBeInTheDocument();
  });

  it("sends a staff member away from a center section, to its OWN home", async () => {
    useAuthStore.setState({ ...AUTHENTICATED_PERSONNEL });

    renderAt(<BoundaryTree />, ROUTES.app.agenda);

    expect(await screen.findByText("staff home")).toBeInTheDocument();
    expect(screen.queryByText("agenda area")).not.toBeInTheDocument();
  });

  it("sends a client away from the staff area, to its OWN home", async () => {
    renderAt(<BoundaryTree />, ROUTES.staff.agenda);

    expect(await screen.findByText("client home")).toBeInTheDocument();
    expect(screen.queryByText("staff agenda")).not.toBeInTheDocument();
  });

  it("sends a center owner away from the staff area, to the shell root", async () => {
    const owner: User = { ...USER, id: "7", role: "BEAUTY_CENTER" };
    useAuthStore.setState({
      user: owner,
      role: "BEAUTY_CENTER",
      status: "authenticated",
      isAuthenticated: true,
    });

    renderAt(<BoundaryTree />, ROUTES.staff.agenda);

    expect(await screen.findByText("app home")).toBeInTheDocument();
    expect(screen.queryByText("staff agenda")).not.toBeInTheDocument();
  });
});

describe("GuestOnly", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authRepository.getCurrentUser.mockResolvedValue(USER);
    mocks.authRepository.isAuthenticated.mockResolvedValue(true);
    useAuthStore.setState({ ...UNAUTHENTICATED });
  });

  it("redirects authenticated users away from /login to the app home", async () => {
    useAuthStore.setState({ ...AUTHENTICATED_CLIENT });

    renderAt(<GuestTree />, ROUTES.login);

    expect(await screen.findByText("app home")).toBeInTheDocument();
    expect(screen.queryByText("login form")).not.toBeInTheDocument();
  });
});
