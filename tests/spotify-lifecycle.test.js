import { describe, expect, test } from "bun:test";
import { SpotifyService } from "../src/lib/spotify";

const env = {
  SPOTIFY_CLIENT_ID: "fixture-id",
  SPOTIFY_CLIENT_SECRET: "fixture-secret",
  SPOTIFY_REFRESH_TOKEN: "fixture-refresh",
};
const token = () => Response.json({ access_token: "fixture-access", expires_in: 3600 });
const track = (name = "Track") => ({
  is_playing: true,
  progress_ms: 42_000,
  item: {
    type: "track",
    name,
    artists: [{ name: "Artist" }],
    duration_ms: 240_000,
    external_urls: { spotify: "https://open.spotify.com/track/test" },
  },
});
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe("Spotify request lifecycle", () => {
  test("shares a cold refresh, a 401 retry, and an expired-cache refresh between callers", async () => {
    let now = 0;
    const responses = [
      token(),
      new Response(null, { status: 401 }),
      token(),
      Response.json(track()),
      Response.json(track("Next")),
    ];
    const calls = [];
    const service = new SpotifyService({
      now: () => now,
      logger: {},
      fetchImpl: async (url) => {
        calls.push(url);
        return responses.shift();
      },
    });
    const first = await Promise.all(Array.from({ length: 10 }, () => service.getStatus(env)));
    expect(first.every((result) => result.data.title === "Track")).toBe(true);
    expect(calls).toHaveLength(4);
    now = 30_000;
    const next = await Promise.all(Array.from({ length: 10 }, () => service.getStatus(env)));
    expect(next.every((result) => result.data.title === "Next")).toBe(true);
    expect(calls).toHaveLength(5);
  });

  test.each([
    "token",
    "token body",
    "playback",
    "playback body",
    "terminal error",
    "transient error",
  ])(
    "discards an old configuration's delayed %s without touching the new refresh",
    async (stage) => {
      const reached = deferred();
      const releaseOld = deferred();
      const reachedNew = deferred();
      const releaseNew = deferred();
      const calls = [];
      const events = [];
      let oldSignal;
      const waitOld = async () => {
        reached.resolve();
        await releaseOld.promise;
      };
      const service = new SpotifyService({
        logger: { error: (...args) => events.push(args), warn: (...args) => events.push(args) },
        fetchImpl: async (url, options) => {
          calls.push(url);
          const isToken = url.includes("/api/token");
          const old = isToken
            ? options.body.get("refresh_token") === env.SPOTIFY_REFRESH_TOKEN
            : options.headers.Authorization === "Bearer old";
          if (!old) {
            if (isToken) {
              return token();
            }
            reachedNew.resolve();
            await releaseNew.promise;
            return Response.json(track("New"));
          }
          oldSignal = options.signal;
          if (isToken) {
            if (["token", "terminal error", "transient error"].includes(stage)) {
              await waitOld();
            }
            if (stage === "terminal error") {
              return Response.json({ error: "invalid_grant" }, { status: 400 });
            }
            if (stage === "transient error") {
              throw new Error("old request failed");
            }
            return {
              ok: true,
              json: async () => {
                if (stage === "token body") {
                  await waitOld();
                }
                return { access_token: "old", refresh_token: "old-rotated", expires_in: 3600 };
              },
            };
          }
          if (stage === "playback") {
            await waitOld();
          }
          return {
            ok: true,
            status: 200,
            json: async () => {
              if (stage === "playback body") {
                await waitOld();
              }
              return track("Old");
            },
          };
        },
      });
      const oldRequest = service.getStatus(env);
      await reached.promise;
      const newEnv = { ...env, SPOTIFY_REFRESH_TOKEN: "replacement" };
      const newRequest = service.getStatus(newEnv);
      await reachedNew.promise;
      expect(oldSignal.aborted).toBe(true);
      releaseOld.resolve();
      const discarded = await oldRequest;
      expect(discarded.data.reason).toBe("unavailable");
      expect(discarded.headers["Cache-Control"]).toBe("no-store");
      const count = calls.length;
      const joined = service.getStatus(newEnv);
      releaseNew.resolve();
      expect((await newRequest).data.title).toBe("New");
      expect((await joined).data.title).toBe("New");
      expect((await service.getStatus(newEnv)).data.title).toBe("New");
      expect(calls).toHaveLength(count);
      expect(events).toEqual([]);
    },
  );

  test.each(["reset", "missing configuration"])(
    "invalidates pending work on %s and restores identical credentials",
    async (operation) => {
      const started = deferred();
      const release = deferred();
      let calls = 0;
      let oldSignal;
      const service = new SpotifyService({
        logger: {},
        fetchImpl: async (url, options) => {
          calls++;
          if (calls === 1) {
            oldSignal = options.signal;
            started.resolve();
            await release.promise;
          }
          return url.includes("/api/token") ? token() : Response.json(track());
        },
      });
      const pending = service.getStatus(env);
      await started.promise;
      if (operation === "reset") {
        service.reset();
      } else {
        expect((await service.getStatus({})).data.reason).toBe("configuration_error");
      }
      release.resolve();
      expect((await pending).data.isPlaying).toBe(false);
      expect(oldSignal.aborted).toBe(true);
      expect((await service.getStatus(env)).data.title).toBe("Track");
      expect(calls).toBe(3);
    },
  );

  test("recovers identical settings after a populated cache loses configuration", async () => {
    let calls = 0;
    const service = new SpotifyService({
      logger: {},
      fetchImpl: async (url) => {
        calls++;
        return url.includes("/api/token") ? token() : Response.json(track());
      },
    });
    await service.getStatus(env);
    await service.getStatus({});
    expect((await service.getStatus(env)).data.title).toBe("Track");
    expect(calls).toBe(4);
  });

  test.each(["refresh failure", "retry failure", "repeated 401"])(
    "never revives playback after a 401 and %s",
    async (failure) => {
      let now = 0;
      const responses = [
        token(),
        Response.json(track()),
        new Response(null, { status: 401 }),
        ...(failure === "refresh failure"
          ? [new Error("offline")]
          : [
              token(),
              failure === "repeated 401"
                ? new Response(null, { status: 401 })
                : new Error("offline"),
            ]),
      ];
      const service = new SpotifyService({
        now: () => now,
        logger: {},
        fetchImpl: async () => {
          const result = responses.shift() ?? new Error("offline");
          if (result instanceof Error) {
            throw result;
          }
          return result;
        },
      });
      await service.getStatus(env);
      now = 31_000;
      for (const time of [31_000, 92_000]) {
        now = time;
        const result = await service.getStatus(env);
        expect(result.data.isPlaying).toBe(false);
        expect(result.data.stale).toBeUndefined();
        expect(result.data.title).not.toBe("Track");
        expect(result.headers["Cache-Control"]).toBe("no-store");
      }
    },
  );
});

describe("Spotify server cooldowns", () => {
  test("backs off 60/120/240/300 seconds, shares failures, and resets after recovery", async () => {
    let now = 0;
    let broken = true;
    let calls = 0;
    const service = new SpotifyService({
      now: () => now,
      logger: {},
      fetchImpl: async (url) => {
        calls++;
        if (broken) {
          throw new Error("offline");
        }
        return url.includes("/api/token") ? token() : Response.json(track());
      },
    });
    for (const seconds of [60, 120, 240, 300, 300]) {
      const results = await Promise.all(Array.from({ length: 10 }, () => service.getStatus(env)));
      expect(results.every((result) => result.data.retryAfterSeconds === seconds)).toBe(true);
      const count = calls;
      now += seconds * 1000 - 1;
      expect((await service.getStatus(env)).headers["Retry-After"]).toBe("1");
      expect(calls).toBe(count);
      now++;
    }
    expect(calls).toBe(5);
    broken = false;
    expect((await service.getStatus(env)).data.isPlaying).toBe(true);
    broken = true;
    now += 30_000;
    expect((await service.getStatus(env)).data.retryAfterSeconds).toBe(60);
  });

  test.each(["token", "playback"])(
    "honors a long Retry-After from the %s endpoint",
    async (endpoint) => {
      let now = 0;
      let limited = true;
      let calls = 0;
      const service = new SpotifyService({
        now: () => now,
        logger: {},
        fetchImpl: async (url) => {
          calls++;
          const isToken = url.includes("/api/token");
          if (limited && isToken === (endpoint === "token")) {
            return Response.json({}, { status: 429, headers: { "Retry-After": "600" } });
          }
          return isToken ? token() : Response.json(track());
        },
      });
      expect((await service.getStatus(env)).data.retryAfterSeconds).toBe(600);
      const count = calls;
      now = 599_001;
      const waiting = await service.getStatus(env);
      expect(waiting.headers["Retry-After"]).toBe("1");
      expect(waiting.headers["Cache-Control"]).toBe("no-store");
      expect(calls).toBe(count);
      now = 600_000;
      limited = false;
      expect((await service.getStatus(env)).data.isPlaying).toBe(true);
    },
  );

  test("freezes progress once across cooldowns and failures, then expires stale data without fetching", async () => {
    let now = 0;
    let calls = 0;
    const responses = [
      token(),
      Response.json(track()),
      new Response(null, { status: 500 }),
      Response.json({}, { status: 429, headers: { "Retry-After": "600" } }),
    ];
    const service = new SpotifyService({
      now: () => now,
      logger: {},
      fetchImpl: async () => {
        calls++;
        return responses.shift();
      },
    });
    await service.getStatus(env);
    for (const time of [31_000, 61_000, 91_000, 299_999]) {
      now = time;
      const result = await service.getStatus(env);
      expect(result.data.progressMs).toBe(73_000);
      expect(result.data.progressCapturedAt).toBe(31_000);
      expect(result.data.stale).toBe(true);
      expect(result.headers["Cache-Control"]).toBe("no-store");
    }
    now = 300_000;
    const expired = await service.getStatus(env);
    expect(expired.data.reason).toBe("rate_limited");
    expect(expired.data.isPlaying).toBe(false);
    expect(expired.data.stale).toBeUndefined();
    expect(calls).toBe(4);
  });
});
