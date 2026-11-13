import { useMutation } from "@tanstack/react-query";
import type {
  AuthResult,
  CompleteRegistrationData,
  RegisterData,
  VerifyCodeResult,
} from "yotuvia-core";

import {
  completeRegistrationUseCase,
  dependencies,
  forgotPasswordUseCase,
  loginUserUseCase,
  logoutAllUseCase,
  registerUserUseCase,
  requestLoginCodeUseCase,
  resendVerificationUseCase,
  resetPasswordUseCase,
  socialLoginUseCase,
  verifyEmailUseCase,
  verifyLoginCodeUseCase,
} from "@/di/container";
import { attachErrorKey } from "@/presentation/lib/errors";
import type { SocialAccountType } from "@/presentation/lib/social-auth/types";

/**
 * Auth mutation hooks.
 *
 * Every mutation follows the same shape: a thin `mutationFn` delegating to the
 * container use-case, wrapped by `attachErrorKey` so consumers get a ready
 * i18n key (`errorKey`) for the failed state. The only repository-direct call
 * is `logout`, because the container exposes no `LogoutUseCase` — see the
 * `useLogout` docblock.
 */

export interface LoginVariables {
  email: string;
  password: string;
}

export interface SocialLoginVariables {
  provider: "google" | "facebook";
  token: string;
  /** Kind a first-time signup creates; forwarded to the core use-case. */
  accountType: SocialAccountType;
}

export function useLogin() {
  return attachErrorKey(
    useMutation<AuthResult, Error, LoginVariables>({
      mutationFn: ({ email, password }) => loginUserUseCase.execute(email, password),
    }),
    "web.errors.unauthorized",
  );
}

export function useRegister() {
  return attachErrorKey(
    useMutation<AuthResult, Error, RegisterData>({
      mutationFn: (data) => registerUserUseCase.execute(data),
    }),
    "errors.auth_register",
  );
}

export function useRequestLoginCode() {
  return attachErrorKey(
    useMutation<void, Error, { email: string }>({
      mutationFn: ({ email }) => requestLoginCodeUseCase.execute(email),
    }),
    "web.errors.unknown",
  );
}

export function useVerifyLoginCode() {
  return attachErrorKey(
    useMutation<VerifyCodeResult, Error, { email: string; code: string }>({
      mutationFn: ({ email, code }) => verifyLoginCodeUseCase.execute(email, code),
    }),
    "web.errors.auth_code",
  );
}

export function useCompleteRegistration() {
  return attachErrorKey(
    useMutation<AuthResult, Error, CompleteRegistrationData>({
      mutationFn: (data) => completeRegistrationUseCase.execute(data),
    }),
    "errors.auth_register",
  );
}

export function useSocialLogin() {
  return attachErrorKey(
    useMutation<AuthResult, Error, SocialLoginVariables>({
      mutationFn: ({ provider, token, accountType }) =>
        socialLoginUseCase.execute(provider, token, accountType),
    }),
    "web.errors.social_login",
  );
}

export function useForgotPassword() {
  return attachErrorKey(
    useMutation<void, Error, { email: string }>({
      mutationFn: ({ email }) => forgotPasswordUseCase.execute(email),
    }),
    "errors.auth_forgot_password",
  );
}

export function useResetPassword() {
  return attachErrorKey(
    useMutation<void, Error, { token: string; password: string }>({
      mutationFn: ({ token, password }) => resetPasswordUseCase.execute(token, password),
    }),
    "errors.auth_reset_password",
  );
}

export function useVerifyEmail() {
  return attachErrorKey(
    useMutation<void, Error, { token: string }>({
      mutationFn: ({ token }) => verifyEmailUseCase.execute(token),
    }),
    "errors.auth_verify_email",
  );
}

export function useResendVerification() {
  return attachErrorKey(
    useMutation<void, Error, { email: string }>({
      mutationFn: ({ email }) => resendVerificationUseCase.execute(email),
    }),
    "errors.auth_resend_verification",
  );
}

export function useLogoutAll() {
  return attachErrorKey(
    useMutation<void, Error, void>({
      mutationFn: () => logoutAllUseCase.execute(),
    }),
    "errors.auth_logout_all",
  );
}

/**
 * Clears the current session.
 *
 * Deviates from the use-case pattern on purpose: `IAuthRepository.logout()` has
 * no `LogoutUseCase` in `yotuvia-core`, so the repository is reached through
 * the container's aggregated `dependencies` object.
 */
export function useLogout() {
  return attachErrorKey(
    useMutation<void, Error, void>({
      mutationFn: () => dependencies.authRepository.logout(),
    }),
    "web.errors.unknown",
  );
}
