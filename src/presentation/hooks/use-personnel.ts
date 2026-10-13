import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreatePersonnelData,
  Personnel,
  UpdatePersonnelData,
  VideoFeedResult,
} from "yotuvia-core";

import {
  createPersonnelUseCase,
  deletePersonnelUseCase,
  followPersonnelUseCase,
  generateInvitationUseCase,
  getPersonnelFeedUseCase,
  getPersonnelProfileUseCase,
  getPersonnelUseCase,
  unfollowPersonnelUseCase,
  updatePersonnelUseCase,
} from "@/di/container";
import { attachErrorKey } from "@/presentation/lib/errors";
import { queryKeys } from "@/presentation/lib/query-keys";

/**
 * Center staff hooks (owner personnel section + the agenda assign dialog).
 *
 * `GetPersonnelUseCase.execute(centerId)` resolves `GET /personnel`
 * server-scoped to the center; the query stays idle until a positive center id
 * is available. Every mutation invalidates the personnel domain so the list
 * refetches after a write.
 *
 * The invitation flow reuses `GenerateInvitationUseCase.execute(email)`
 * (`POST /personnel/invitations`), which answers `{ token, link }`. `link` is
 * built by the API from `INVITE_BASE_URL` (`https://yotuvia.com/join/<token>` in
 * production), so the web presents it as an openable anchor.
 * The pending-invitations list is NOT exposed: `IPersonnelRepository.listInvitations`
 * has no use-case wrapper in the container today.
 */

export interface CenterPersonnelOptions {
  /**
   * Set to `false` for a signed-out visitor: `GET /personnel` requires a JWT,
   * so the PUBLIC center detail disables the query until a session exists.
   */
  enabled?: boolean;
}

/**
 * Center staff list, shared cache entry with the agenda assign dialog.
 *
 * The use-case takes only the center id (`GET /personnel?beauty_center_id=`), so
 * the web CANNOT pre-filter staff by the services they can perform — the mobile
 * passes `service_ids` straight to the source. A professional who cannot cover
 * the selected bundle is therefore rejected by the server at booking time and
 * the error is surfaced verbatim.
 */
export function useCenterPersonnel(centerId: number, options: CenterPersonnelOptions = {}) {
  const isEnabled = options.enabled ?? true;
  return useQuery<Personnel[]>({
    queryKey: queryKeys.personnel.list(centerId),
    queryFn: () => getPersonnelUseCase.execute(centerId),
    enabled: centerId > 0 && isEnabled,
  });
}

/**
 * One professional's PUBLIC profile (`GET /personnel/:id`). The endpoint needs
 * a JWT, so the professional page lives in the authenticated client area.
 */
export function usePersonnelProfile(personnelId: number) {
  return useQuery<Personnel>({
    queryKey: queryKeys.personnel.profile(personnelId),
    queryFn: () => getPersonnelProfileUseCase.execute(personnelId),
    enabled: personnelId > 0,
  });
}

/** One professional's public videos (`GET /feed-posts/personnel/:id`). */
export function usePersonnelFeed(personnelId: number) {
  return useQuery<VideoFeedResult>({
    queryKey: queryKeys.personnel.videos(personnelId),
    queryFn: () => getPersonnelFeedUseCase.execute(personnelId),
    enabled: personnelId > 0,
  });
}

/**
 * Follow/unfollow a professional. The server returns the resulting state, which
 * we write straight into the profile cache so the button flips without a
 * refetch.
 */
export function useTogglePersonnelFollow(personnelId: number) {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<boolean, Error, boolean>({
      mutationFn: (follow) =>
        follow
          ? followPersonnelUseCase.execute(personnelId)
          : unfollowPersonnelUseCase.execute(personnelId),
      onSuccess: (isFollowing) => {
        queryClient.setQueryData<Personnel>(
          queryKeys.personnel.profile(personnelId),
          (prev) => (prev ? { ...prev, isFollowing } : prev),
        );
      },
    }),
    "web.errors.personnel_follow",
  );
}

function useInvalidatePersonnel(): () => Promise<void> {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.personnel.all });
}

/** Registers a staff member for the center (`POST /auth/register-personnel`). */
export function useCreatePersonnel() {
  const invalidate = useInvalidatePersonnel();
  return attachErrorKey(
    useMutation<void, Error, CreatePersonnelData>({
      mutationFn: (data) => createPersonnelUseCase.execute(data),
      onSuccess: () => invalidate(),
    }),
    "web.errors.personnel_save",
  );
}

export interface UpdatePersonnelVariables {
  personnelId: number;
  data: UpdatePersonnelData;
}

/** Updates a staff member (also used for the activate/deactivate toggle). */
export function useUpdatePersonnel() {
  const invalidate = useInvalidatePersonnel();
  return attachErrorKey(
    useMutation<void, Error, UpdatePersonnelVariables>({
      mutationFn: ({ personnelId, data }) => updatePersonnelUseCase.execute(personnelId, data),
      onSuccess: () => invalidate(),
    }),
    "web.errors.personnel_save",
  );
}

/** Deletes a staff member. */
export function useDeletePersonnel() {
  const invalidate = useInvalidatePersonnel();
  return attachErrorKey(
    useMutation<void, Error, number>({
      mutationFn: (personnelId) => deletePersonnelUseCase.execute(personnelId),
      onSuccess: () => invalidate(),
    }),
    "web.errors.personnel_delete",
  );
}

/** Generates an invitation and resolves with its `{ token, link }`. */
export function useGenerateInvitation() {
  return attachErrorKey(
    useMutation<{ token: string; link: string }, Error, string>({
      mutationFn: (email) => generateInvitationUseCase.execute(email),
    }),
    "web.errors.personnel_invite",
  );
}
