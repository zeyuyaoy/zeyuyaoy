import { describe, expect, it } from "bun:test";
import {
  getSpotifyPollDecision,
  MAX_SPOTIFY_BACKOFF_INTERVAL,
  NORMAL_SPOTIFY_POLL_INTERVAL,
} from "@/lib/spotify-polling";

describe("Spotify widget polling", () => {
  it("stops for terminal reauthorization failures", () => {
    expect(
      getSpotifyPollDecision(
        {
          fallback: true,
          reason: "reauthorization_required",
        },
        2,
      ),
    ).toEqual({
      consecutiveFailures: 2,
      delay: null,
      stop: true,
    });
  });

  it("backs off transient failures up to five minutes", () => {
    let decision = getSpotifyPollDecision({ fallback: true }, 0);
    expect(decision.delay).toBe(60_000);

    decision = getSpotifyPollDecision({ stale: true }, decision.consecutiveFailures);
    expect(decision.delay).toBe(120_000);

    decision = getSpotifyPollDecision({ fallback: true }, 20);
    expect(decision.delay).toBe(MAX_SPOTIFY_BACKOFF_INTERVAL);
  });

  it("honors Retry-After values longer than the normal backoff cap", () => {
    const decision = getSpotifyPollDecision({
      fallback: true,
      retryAfterSeconds: 600,
    });

    expect(decision.delay).toBe(600_000);
  });

  it("resets to the normal interval after success", () => {
    expect(getSpotifyPollDecision({ isPlaying: false }, 4)).toEqual({
      consecutiveFailures: 0,
      delay: NORMAL_SPOTIFY_POLL_INTERVAL,
      stop: false,
    });
  });
});

it("caps Retry-After at the browser timer limit instead of overflowing into rapid retries", () => {
  const decision = getSpotifyPollDecision({ fallback: true, retryAfterSeconds: Number.MAX_VALUE });
  expect(decision.delay).toBe(2_147_483_647);
});
