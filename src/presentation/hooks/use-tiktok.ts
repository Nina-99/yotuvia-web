import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  disconnectTikTok,
  getTikTokAccount,
  getTikTokConnectUrl,
  getTikTokVideos,
  importTikTokVideo,
} from "yotuvia-core";
import type { FeedPostItem, ImportTikTokVideoInput } from "yotuvia-core";

import { attachErrorKey } from "@/presentation/lib/errors";
import { queryKeys } from "@/presentation/lib/query-keys";

/**
 * TikTok connect-account hooks for the owner content page.
 *
 * The endpoints are inert unless the backend has TikTok credentials, so the
 * account probe drives the UI: a disabled integration reports `enabled: false`
 * and the connect action is hidden.
 */

/** Connected-account probe. `enabled` keeps it idle until authenticated. */
export function useTikTokAccount(enabled = true) {
  return useQuery({
    queryKey: queryKeys.tiktok.account(),
    queryFn: () => getTikTokAccount(),
    enabled,
  });
}

/** The connected user's own TikTok videos. Idle until connected. */
export function useTikTokVideos(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.tiktok.videos(),
    queryFn: () => getTikTokVideos(),
    enabled,
  });
}

/**
 * Starts the OAuth flow: fetches the authorization URL and hands the browser
 * over to TikTok. This is a full-page navigation, not an XHR — the state
 * cookie/redirect round-trip only works in the top-level document.
 */
export function useConnectTikTok() {
  return attachErrorKey(
    useMutation<string, Error, void>({
      mutationFn: () => getTikTokConnectUrl(),
      onSuccess: (url) => {
        window.location.assign(url);
      },
    }),
    "web.errors.tiktok_connect",
  );
}

/** Imports one video as an external feed post, refreshing the content list. */
export function useImportTikTokVideo() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<FeedPostItem, Error, ImportTikTokVideoInput>({
      mutationFn: (input) => importTikTokVideo(input),
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: queryKeys.content.all }),
    }),
    "web.errors.tiktok_import",
  );
}

/** Revokes and forgets the connection. */
export function useDisconnectTikTok() {
  const queryClient = useQueryClient();
  return attachErrorKey(
    useMutation<void, Error, void>({
      mutationFn: () => disconnectTikTok(),
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: queryKeys.tiktok.all }),
    }),
    "web.errors.tiktok_disconnect",
  );
}
