/**
 * Bridge to the OFFICIAL TikTok player.
 *
 * The player renders inside a CROSS-ORIGIN iframe, so its DOM is out of reach —
 * no stylesheet can cross that boundary, which is why its like/comment/share
 * rail cannot be hidden here (it could on mobile, where the WebView's own
 * document WAS the player page).
 *
 * `postMessage` is the one channel that crosses origins, and it is exactly the
 * API TikTok documents for driving the player. The OUTER srcdoc document is
 * same-origin with this page — that is what `allow-same-origin` buys — so it can
 * be read to find the player frame and post into it.
 */

/** Commands the player accepts from its host (`x-tiktok-player`). */
export type PlayerCommand = "play" | "pause" | "mute" | "unMute";

/** Marker every host→player message must carry. */
const PLAYER_MESSAGE_FLAG = "x-tiktok-player";

/** The id the shared embed builder gives the player frame. */
const PLAYER_FRAME_SELECTOR = 'iframe[id="embed"]';

/**
 * Sends `command` to the player inside `outer`.
 *
 * Best-effort by design: a missing frame (not mounted yet, or a provider with
 * no such player) is a no-op rather than an error, so callers never have to
 * guard. Whether the browser then HONOURS the command is its own business — an
 * unmute before the visitor has interacted with the site is refused.
 */
export function postToPlayer(outer: HTMLIFrameElement | null, command: PlayerCommand): void {
  const inner = outer?.contentDocument?.querySelector<HTMLIFrameElement>(PLAYER_FRAME_SELECTOR);
  inner?.contentWindow?.postMessage({ type: command, [PLAYER_MESSAGE_FLAG]: true }, "*");
}
