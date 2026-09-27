import type {SpotifyStatus} from "./spotify-contract";

export const NORMAL_SPOTIFY_POLL_INTERVAL = 30 * 1000;
export const MAX_SPOTIFY_BACKOFF_INTERVAL = 5 * 60 * 1000;

export function getSpotifyPollDecision(data: Partial<SpotifyStatus>, consecutiveFailures = 0) {
  if (data.reason === "reauthorization_required") {
    return {
      consecutiveFailures,
      delay: null,
      stop: true,
    };
  }

  if (data.stale || data.fallback) {
    const nextFailureCount = Math.min(consecutiveFailures + 1, 4);
    const exponentialDelay = Math.min(
      NORMAL_SPOTIFY_POLL_INTERVAL * 2 ** nextFailureCount,
      MAX_SPOTIFY_BACKOFF_INTERVAL,
    );
    const retryAfterMs =
      typeof data.retryAfterSeconds === "number" && Number.isFinite(data.retryAfterSeconds)
        ? Math.max(0, data.retryAfterSeconds * 1000)
        : 0;

    return {
      consecutiveFailures: nextFailureCount,
      delay:
        retryAfterMs > 0
          ? Math.min(2_147_483_647, Math.max(exponentialDelay, retryAfterMs))
          : exponentialDelay,
      stop: false,
    };
  }

  return {
    consecutiveFailures: 0,
    delay: NORMAL_SPOTIFY_POLL_INTERVAL,
    stop: false,
  };
}
