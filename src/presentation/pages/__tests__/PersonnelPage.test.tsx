import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Personnel, User } from "yotuvia-core";

const mocks = vi.hoisted(() => ({
  personnelExecute: vi.fn(),
  createPersonnelExecute: vi.fn(),
  updatePersonnelExecute: vi.fn(),
  deletePersonnelExecute: vi.fn(),
  invitationExecute: vi.fn(),
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
  getPersonnelUseCase: { execute: mocks.personnelExecute },
  createPersonnelUseCase: { execute: mocks.createPersonnelExecute },
  updatePersonnelUseCase: { execute: mocks.updatePersonnelExecute },
  deletePersonnelUseCase: { execute: mocks.deletePersonnelExecute },
  generateInvitationUseCase: { execute: mocks.invitationExecute },
}));

import i18n from "@/presentation/i18n";
import { ROUTES } from "@/presentation/lib/routes";
import { PersonnelPage } from "@/presentation/pages/PersonnelPage";
import { useAuthStore } from "@/presentation/stores/use-auth-store";
import { renderWithProviders } from "@/test/render-with-providers";

const OWNER: User = {
  id: "7",
  firstName: "Ana",
  lastName: "Díaz",
  email: "ana@example.com",
  role: "BEAUTY_CENTER",
};

const ANA: Personnel = {
  id: 11,
  beautyCenterId: 7,
  firstName: "Ana",
  lastName: "Gómez",
  email: "ana@example.com",
  phone: "111",
  isActive: true,
};

const BETO: Personnel = {
  id: 12,
  beautyCenterId: 7,
  firstName: "Beto",
  lastName: "Ruiz",
  email: "beto@example.com",
  phone: "222",
  isActive: false,
};

const writeText = vi.fn().mockResolvedValue(undefined);

function authenticate() {
  useAuthStore.setState({
    user: OWNER,
    role: OWNER.role,
    status: "authenticated",
    isAuthenticated: true,
  });
}

describe("PersonnelPage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    authenticate();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  it("renders the center staff returned by the use-case", async () => {
    mocks.personnelExecute.mockResolvedValue([ANA, BETO]);

    renderWithProviders(<PersonnelPage />, { route: ROUTES.app.personnel });

    expect(await screen.findByText("Ana Gómez")).toBeInTheDocument();
    expect(screen.getByText("Beto Ruiz")).toBeInTheDocument();
    expect(screen.getByText("beto@example.com")).toBeInTheDocument();
    expect(screen.getByTestId("personnel-row-11")).toBeInTheDocument();
    expect(mocks.personnelExecute).toHaveBeenCalledWith(7);
  });

  it("staggers the staff rows through the reveal delay variable", async () => {
    mocks.personnelExecute.mockResolvedValue([ANA, BETO]);

    renderWithProviders(<PersonnelPage />, { route: ROUTES.app.personnel });

    await screen.findByText("Ana Gómez");

    const first = screen.getByTestId("personnel-row-11");
    const second = screen.getByTestId("personnel-row-12");
    expect(first).toHaveClass("ytv-stagger");
    expect(second).toHaveClass("ytv-stagger");
    expect(first.style.getPropertyValue("--ytv-reveal-delay")).not.toBe("");
    expect(second.style.getPropertyValue("--ytv-reveal-delay")).not.toBe("");
  });

  it("creates a staff member and refreshes the list through query invalidation", async () => {
    const user = userEvent.setup();
    mocks.personnelExecute.mockResolvedValueOnce([]).mockResolvedValue([ANA]);
    mocks.createPersonnelExecute.mockResolvedValue(undefined);

    renderWithProviders(<PersonnelPage />, { route: ROUTES.app.personnel });

    expect(await screen.findByText("No staff yet")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add staff" }));
    await user.type(screen.getByLabelText("First name"), "Ana");
    await user.type(screen.getByLabelText("Last name"), "Gómez");
    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.type(screen.getByLabelText("Phone"), "111");
    await user.type(screen.getByLabelText("Temporary password"), "supersecret");
    await user.click(screen.getByRole("button", { name: "Add staff member" }));

    expect(await screen.findByText("Ana Gómez")).toBeInTheDocument();
    expect(mocks.createPersonnelExecute).toHaveBeenCalledWith({
      firstName: "Ana",
      lastName: "Gómez",
      email: "ana@example.com",
      phone: "+591 111",
      password: "supersecret",
      beautyCenterId: 7,
    });
    expect(mocks.personnelExecute).toHaveBeenCalledTimes(2);
  });

  it("asks for confirmation before deleting a staff member", async () => {
    const user = userEvent.setup();
    mocks.personnelExecute.mockResolvedValueOnce([ANA, BETO]).mockResolvedValue([BETO]);
    mocks.deletePersonnelExecute.mockResolvedValue(undefined);

    renderWithProviders(<PersonnelPage />, { route: ROUTES.app.personnel });

    expect(await screen.findByText("Ana Gómez")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete Ana Gómez" }));

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/Ana Gómez.*will be deleted permanently/),
    ).toBeInTheDocument();
    expect(mocks.deletePersonnelExecute).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Delete staff member" }));

    expect(mocks.deletePersonnelExecute).toHaveBeenCalledWith(11);
    expect(await screen.findByText("Beto Ruiz")).toBeInTheDocument();
    expect(screen.queryByText("Ana Gómez")).not.toBeInTheDocument();
  });

  it("keeps the confirmation dialog open when the delete fails", async () => {
    const user = userEvent.setup();
    mocks.personnelExecute.mockResolvedValue([ANA]);
    mocks.deletePersonnelExecute.mockRejectedValue(
      Object.assign(new Error("nope"), { response: { status: 403 } }),
    );

    renderWithProviders(<PersonnelPage />, { route: ROUTES.app.personnel });

    expect(await screen.findByText("Ana Gómez")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete Ana Gómez" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete staff member" }));

    expect(
      await within(dialog).findByText("You don't have permission to do this"),
    ).toBeInTheDocument();
    expect(screen.getByText("Ana Gómez")).toBeInTheDocument();
  });

  it("generates an invitation and shows the link and code as copyable values", async () => {
    const user = userEvent.setup();
    // `userEvent.setup()` installs its own clipboard stub, so the spy must be
    // created after it to observe the actual write.
    const writeSpy = vi.spyOn(navigator.clipboard, "writeText");
    mocks.personnelExecute.mockResolvedValue([]);
    mocks.invitationExecute.mockResolvedValue({
      token: "abc123token",
      link: "yotuvia://join/abc123token",
    });

    renderWithProviders(<PersonnelPage />, { route: ROUTES.app.personnel });

    expect(await screen.findByText("No staff yet")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Invite" }));
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.click(screen.getByRole("button", { name: "Generate invitation" }));

    expect(await screen.findByText("Invitation ready")).toBeInTheDocument();
    expect(mocks.invitationExecute).toHaveBeenCalledWith("new@example.com");

    // The link is a real, openable URL; the token stays copyable text.
    const link = screen.getByRole("link", { name: "yotuvia://join/abc123token" });
    expect(link).toHaveAttribute("href", "yotuvia://join/abc123token");
    expect(screen.getByLabelText("Invitation code")).toHaveValue("abc123token");
    expect(screen.queryByText(/mobile app/i)).not.toBeInTheDocument();

    const copyButtons = screen.getAllByRole("button", { name: "Copy" });
    await user.click(copyButtons[0]);
    expect(writeSpy).toHaveBeenCalledWith("yotuvia://join/abc123token");
  });

  it("shows the error state and recovers on retry", async () => {
    const user = userEvent.setup();
    mocks.personnelExecute.mockRejectedValue(new Error("boom"));

    renderWithProviders(<PersonnelPage />, { route: ROUTES.app.personnel });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/couldn't load your staff/i);

    mocks.personnelExecute.mockReset();
    mocks.personnelExecute.mockResolvedValue([ANA]);

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Ana Gómez")).toBeInTheDocument();
  });
});
