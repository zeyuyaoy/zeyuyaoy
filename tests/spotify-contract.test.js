import { describe, expect, test } from "bun:test";
import { parseSpotifyStatus, parseSpotifyTrack } from "../src/lib/spotify-contract";
import { SpotifyService } from "../src/lib/spotify";

const valid = {
  is_playing: true,
  progress_ms: 1000,
  item: {
    type: "track",
    name: "Track",
    artists: [{ name: "Artist" }],
    duration_ms: 2000,
    album: { name: "Album", images: [{ url: "https://i.scdn.co/image/cover" }] },
    external_urls: { spotify: "https://open.spotify.com/track/1" },
  },
};
const env = {
  SPOTIFY_CLIENT_ID: "id",
  SPOTIFY_CLIENT_SECRET: "secret",
  SPOTIFY_REFRESH_TOKEN: "refresh",
};

describe("Spotify rendering contract", () => {
  test("validates the complete server-to-client track", () => {
    const track = parseSpotifyTrack(valid);
    expect(parseSpotifyStatus(track).title).toBe("Track");
  });

  test.each([
    (item) => {
      item.name = {};
    },
    (item) => {
      item.artists = [{ name: {} }];
    },
    (item) => {
      item.album.name = {};
    },
    (item) => {
      item.external_urls.spotify = "javascript:alert(1)";
    },
    (item) => {
      item.external_urls.spotify = "https://evil.example/track/1";
    },
  ])("rejects malformed required track fields", (mutate) => {
    const body = structuredClone(valid);
    mutate(body.item);
    expect(() => parseSpotifyTrack(body)).toThrow("invalid_response");
  });

  test("drops unsupported artwork and invalid timing without breaking valid music", () => {
    const body = structuredClone(valid);
    body.item.album.images[0].url = "https://untrusted.example/image";
    body.item.duration_ms = Infinity;
    body.progress_ms = -1;

    const track = parseSpotifyTrack(body);
    expect(track.albumImageUrl).toBeNull();
    expect(track.durationMs).toBeNull();
    expect(track.progressMs).toBeNull();
    expect(track.isPlaying).toBe(true);
  });

  test.each(
    [
      null,
      [],
      { isPlaying: "true" },
      { isPlaying: true },
      { isPlaying: false, message: {} },
      {
        isPlaying: false,
        stale: "false",
      },
    ].map((value) => [value]),
  )("rejects malformed public payloads %j", (data) => {
    expect(() => parseSpotifyStatus(data)).toThrow();
  });

  test("retains stale and operator-action fields for polling decisions", () => {
    expect(
      parseSpotifyStatus({
        isPlaying: false,
        fallback: true,
        reason: "reauthorization_required",
      }).reason,
    ).toBe("reauthorization_required");

    expect(
      parseSpotifyStatus({
        ...parseSpotifyTrack(valid),
        stale: true,
        retryAfterSeconds: 90,
      }).retryAfterSeconds,
    ).toBe(90);
  });
});

describe("Spotify service failure boundaries", () => {
  test.each([
    { access_token: "", expires_in: 3600 },
    { access_token: "token", expires_in: -1 },
    {
      access_token: "token",
      expires_in: "3600",
    },
  ])("rejects invalid successful token responses %j", async (body) => {
    const service = new SpotifyService({ fetchImpl: async () => Response.json(body), logger: {} });
    const result = await service.getStatus(env);
    expect(result.data.reason).toBe("invalid_response");
    expect(result.headers["Cache-Control"]).toBe("no-store");
  });

  test("reports sanitized timeout once and recovery after the upstream recovers", async () => {
    const events = [];
    let broken = true;
    let now = 0;
    const service = new SpotifyService({
      now: () => now,
      logger: { warn: (...args) => events.push(args), info: (...args) => events.push(args) },
      fetchImpl: async (url) => {
        if (broken) {
          throw new DOMException("token=secret", "TimeoutError");
        }

        return String(url).includes("/api/token")
          ? Response.json({
              access_token: "token",
              expires_in: 3600,
            })
          : Response.json(valid);
      },
    });

    expect((await service.getStatus(env)).data.reason).toBe("timeout");
    await service.getStatus(env);
    expect(events).toHaveLength(1);
    expect(JSON.stringify(events)).not.toContain("secret");

    broken = false;
    now = 60_000;
    expect((await service.getStatus(env)).data.isPlaying).toBe(true);
    expect(events.at(-1)[1].state).toBe("recovered");
  });

  test("a malformed playback payload degrades safely through the real service", async () => {
    const service = new SpotifyService({
      logger: {},
      fetchImpl: async (url) =>
        String(url).includes("/api/token")
          ? Response.json({ access_token: "token", expires_in: 3600 })
          : new Response("not JSON"),
    });

    expect((await service.getStatus(env)).data.reason).toBe("invalid_response");
  });
});

test("access revocation clears stale playback before a later network failure", async () => {
  let time = 0;
  let playbackCalls = 0;
  const service = new SpotifyService({
    now: () => time,
    logger: {},
    fetchImpl: async (url) => {
      if (String(url).includes("/api/token")) {
        return Response.json({ access_token: "token", expires_in: 3600 });
      }
      playbackCalls++;

      if (playbackCalls === 1) {
        return Response.json(valid);
      }

      if (playbackCalls === 2) {
        return new Response(null, { status: 403 });
      }

      throw new Error("offline");
    },
  });

  expect((await service.getStatus(env)).data.isPlaying).toBe(true);
  time = 31_000;

  expect((await service.getStatus(env)).data.reason).toBe("limited_access");
  time = 32_000;

  const result = await service.getStatus(env);
  expect(result.data.stale).toBeUndefined();
  expect(result.data.isPlaying).toBe(false);
});
