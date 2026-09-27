import {describe, expect, it} from "bun:test";
import {clampPlaybackProgress, formatPlaybackTime, getSpotifyPlaybackProgress,} from "@/lib/spotify-playback";

describe("Spotify playback display helpers", () => {
  it("formats short and long playback times", () => {
    expect(formatPlaybackTime(102_900)).toBe("1:42");
    expect(formatPlaybackTime(3_723_000)).toBe("1:02:03");
  });

  it("clamps invalid and over-duration progress", () => {
    expect(clampPlaybackProgress(-100, 240_000)).toBe(0);
    expect(clampPlaybackProgress(300_000, 240_000)).toBe(240_000);
    expect(clampPlaybackProgress(10_000, null)).toBe(0);
  });

  it("advances a live snapshot from its capture time", () => {
    expect(
      getSpotifyPlaybackProgress(
        {
          durationMs: 240_000,
          isPlaying: true,
          progressCapturedAt: 1_000,
          progressMs: 42_000,
        },
        6_000,
      ),
    ).toBe(47_000);
  });

  it("freezes stale and inactive snapshots", () => {
    const playback = {
      durationMs: 240_000,
      isPlaying: true,
      progressCapturedAt: 1_000,
      progressMs: 42_000,
      stale: true,
    };

    expect(getSpotifyPlaybackProgress(playback, 60_000)).toBe(42_000);
    expect(
      getSpotifyPlaybackProgress({...playback, isPlaying: false, stale: false}, 60_000),
    ).toBe(42_000);
  });

  it("stops at the track duration", () => {
    expect(
      getSpotifyPlaybackProgress(
        {
          durationMs: 60_000,
          isPlaying: true,
          progressCapturedAt: 0,
          progressMs: 59_000,
        },
        5_000,
      ),
    ).toBe(60_000);
  });
});

it("formats invalid times safely and never advances a future snapshot", () => {
  expect(formatPlaybackTime(Infinity)).toBe("0:00");
  expect(formatPlaybackTime(NaN)).toBe("0:00");
  expect(
    getSpotifyPlaybackProgress(
      {
        isPlaying: true,
        durationMs: 20_000,
        progressMs: 1000,
        progressCapturedAt: 10_000,
      },
      5000,
    ),
  ).toBe(1000);
});
