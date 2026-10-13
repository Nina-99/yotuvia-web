import { useMutation, useQuery } from "@tanstack/react-query";
import type { UseFormReturn } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import type { PersonnelInvitation } from "yotuvia-core";

import { acceptInvitationUseCase, getInvitationByTokenUseCase } from "@/di/container";
import { useZodForm } from "@/presentation/components/form";
import { attachErrorKey, getErrorStatus, toErrorKey } from "@/presentation/lib/errors";
import { queryKeys } from "@/presentation/lib/query-keys";
import { ROUTES } from "@/presentation/lib/routes";
import {
  acceptInvitationSchema,
  EMPTY_JOIN_FORM,
  toAcceptInvitationData,
} from "@/presentation/schemas/personnel.schemas";
import type { AcceptInvitationFormValues } from "@/presentation/schemas/personnel.schemas";

/**
 * Public invitation acceptance view-model.
 *
 * Drives the `/join/:token` page from two existing core use-cases:
 * - `getInvitationByTokenUseCase.execute(token)` (`GET /personnel/invite/:token`,
 *   public) resolves the preview: center name, invited email and expiry.
 * - `acceptInvitationUseCase.execute(data)` (`POST /personnel/accept-invite`)
 *   creates the professional. `Accept` answers `{ message }` only — no session
 *   is issued — so success navigates to `/login` for the invitee to sign in.
 *
 * State machine: `loading | ready | invalid | error`. The lookup returns the
 * same 4xx family for an unknown, expired or already-used token, so those
 * collapse into ONE translated `invalid` state (raw server text is never
 * shown); a network failure or a 5xx becomes `error`, which is retryable.
 */

export type JoinState = "loading" | "ready" | "invalid" | "error";

export interface UseJoinInvitationResult {
  state: JoinState;
  invitation: PersonnelInvitation | null;
  /** i18n key for a lookup (`error`) or accept (`ready`) failure, else `null`. */
  errorKey: string | null;
  form: UseFormReturn<AcceptInvitationFormValues>;
  submit: (values: AcceptInvitationFormValues) => Promise<void>;
  submitting: boolean;
  retry: () => void;
}

export function useJoinInvitation(token: string | undefined): UseJoinInvitationResult {
  const navigate = useNavigate();

  const query = useQuery<PersonnelInvitation>({
    queryKey: queryKeys.personnel.invitation(token ?? ""),
    queryFn: () => getInvitationByTokenUseCase.execute(token as string),
    enabled: Boolean(token),
    retry: false,
  });

  const accept = attachErrorKey(
    useMutation<void, Error, AcceptInvitationFormValues>({
      mutationFn: (values) =>
        acceptInvitationUseCase.execute(toAcceptInvitationData(values, token ?? "")),
      onSuccess: () => navigate(ROUTES.login),
    }),
    "web.join.accept_error",
  );

  const status = query.error == null ? undefined : getErrorStatus(query.error);

  let state: JoinState;
  if (!token) {
    state = "invalid";
  } else if (query.isPending) {
    state = "loading";
  } else if (query.isError) {
    state = status !== undefined && status >= 400 && status < 500 ? "invalid" : "error";
  } else {
    state = "ready";
  }

  const errorKey =
    accept.errorKey ?? (state === "error" ? toErrorKey(query.error, "web.errors.unknown") : null);

  const form = useZodForm<AcceptInvitationFormValues>({
    schema: acceptInvitationSchema,
    defaultValues: EMPTY_JOIN_FORM,
  });

  return {
    state,
    invitation: query.data ?? null,
    errorKey,
    form,
    submit: (values) => accept.mutateAsync(values),
    submitting: accept.isPending,
    retry: () => {
      void query.refetch();
    },
  };
}
