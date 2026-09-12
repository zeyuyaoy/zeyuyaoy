import {describe, expect, it} from "bun:test";
import {SpotifyService} from "@/lib/spotify";

const env = {
    SPOTIFY_CLIENT_ID: "client-id",
    SPOTIFY_CLIENT_SECRET: "client-secret",
    SPOTIFY_REFRESH_TOKEN: "refresh-token",
};

const trackPayload = {
    is_playing: true,
    currently_playing_type: "track",
    item: {
        type: "track",
        name: "Test Track",
        artists: [{name: "First Artist"}, {name: "Second Artist"}],
        album: {
            name: "Test Album",
            images: [{url: "https://i.scdn.co/image/test"}],
        },
        external_urls: {spotify: "https://open.spotify.com/track/test"},
    },
};

function jsonResponse(body, status = 200, headers = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {"Content-Type": "application/json", ...headers},
    });
}

function emptyResponse(status, headers = {}) {
    return new Response(null, {status, headers});
}

function fetchSequence(...responses) {
    const calls = [];
    const fetchImpl = async (...args) => {
        calls.push(args);
        const response = responses.shift();
        if (response instanceof Error) {
            throw response;
        }
        if (!response) {
            throw new Error("Unexpected fetch call");
        }
        return response;
    };
    return {calls, fetchImpl};
}

const silentLogger = {
    error() {
    }
};

describe("SpotifyService", () => {
    it("returns the current track and caches the access token", async () => {
        let now = 0;
        const fetches = fetchSequence(
            jsonResponse({access_token: "access-1", expires_in: 3600}),
            jsonResponse(trackPayload),
            jsonResponse(trackPayload),
        );
        const service = new SpotifyService({
            fetchImpl: fetches.fetchImpl,
            now: () => now,
            logger: silentLogger,
        });

        const first = await service.getStatus(env);
        now += 31_000;
        const second = await service.getStatus(env);

        expect(first.data).toEqual({
            album: "Test Album",
            albumImageUrl: "https://i.scdn.co/image/test",
            artist: "First Artist and Second Artist",
            isPlaying: true,
            songUrl: "https://open.spotify.com/track/test",
            title: "Test Track",
        });
        expect(second.data.title).toBe("Test Track");
        expect(first.headers["Cache-Control"]).toContain("s-maxage=30");
        expect(fetches.calls).toHaveLength(3);
        expect(fetches.calls.filter(([url]) => String(url).includes("/api/token"))).toHaveLength(1);
    });

    it("maps a 204 response to not playing", async () => {
        const fetches = fetchSequence(
            jsonResponse({access_token: "access", expires_in: 3600}),
            emptyResponse(204),
        );
        const service = new SpotifyService({fetchImpl: fetches.fetchImpl, logger: silentLogger});

        const result = await service.getStatus(env);

        expect(result.data).toEqual({isPlaying: false});
    });

    it("treats unsupported playback types as not playing", async () => {
        const fetches = fetchSequence(
            jsonResponse({access_token: "access", expires_in: 3600}),
            jsonResponse({is_playing: true, item: {type: "episode", name: "Episode"}}),
        );
        const service = new SpotifyService({fetchImpl: fetches.fetchImpl, logger: silentLogger});

        expect((await service.getStatus(env)).data).toEqual({isPlaying: false});
    });

    it("makes invalid_grant terminal and does not retry it", async () => {
        const fetches = fetchSequence(
            jsonResponse({error: "invalid_grant"}, 400),
        );
        const service = new SpotifyService({fetchImpl: fetches.fetchImpl, logger: silentLogger});

        const first = await service.getStatus(env);
        const second = await service.getStatus(env);

        expect(first.data.reason).toBe("reauthorization_required");
        expect(first.headers["Cache-Control"]).toBe("no-store");
        expect(second.data.reason).toBe("reauthorization_required");
        expect(fetches.calls).toHaveLength(1);
    });

    it("recovers from a terminal failure when configured credentials change", async () => {
        const fetches = fetchSequence(
            jsonResponse({error: "invalid_grant"}, 400),
            jsonResponse({access_token: "access", expires_in: 3600}),
            emptyResponse(204),
        );
        const service = new SpotifyService({fetchImpl: fetches.fetchImpl, logger: silentLogger});

        expect((await service.getStatus(env)).data.reason).toBe("reauthorization_required");
        expect((await service.getStatus({
            ...env,
            SPOTIFY_REFRESH_TOKEN: "replacement-token",
        })).data).toEqual({isPlaying: false});
        expect(fetches.calls).toHaveLength(3);
    });

    it("does not leak cached playback after invalid_grant", async () => {
        let now = 0;
        const fetches = fetchSequence(
            jsonResponse({access_token: "access", expires_in: 61}),
            jsonResponse(trackPayload),
            jsonResponse({error: "invalid_grant"}, 400),
        );
        const service = new SpotifyService({
            fetchImpl: fetches.fetchImpl,
            now: () => now,
            logger: silentLogger,
        });

        expect((await service.getStatus(env)).data.title).toBe("Test Track");
        now += 31_000;
        const expired = await service.getStatus(env);

        expect(expired.data.reason).toBe("reauthorization_required");
        expect(expired.data.title).toBe("Spotify status unavailable");
        expect(expired.data.stale).toBeUndefined();
    });

    it("retries playback 401 once with a new access token", async () => {
        const fetches = fetchSequence(
            jsonResponse({access_token: "access-1", expires_in: 3600}),
            emptyResponse(401),
            jsonResponse({access_token: "access-2", expires_in: 3600}),
            jsonResponse(trackPayload),
        );
        const service = new SpotifyService({fetchImpl: fetches.fetchImpl, logger: silentLogger});

        const result = await service.getStatus(env);

        expect(result.data.title).toBe("Test Track");
        expect(fetches.calls).toHaveLength(4);
        expect(fetches.calls[3][1].headers.Authorization).toBe("Bearer access-2");
    });

    it("maps 403 to limited access", async () => {
        const fetches = fetchSequence(
            jsonResponse({access_token: "access", expires_in: 3600}),
            emptyResponse(403),
        );
        const service = new SpotifyService({fetchImpl: fetches.fetchImpl, logger: silentLogger});

        expect((await service.getStatus(env)).data.reason).toBe("limited_access");
    });

    it("distinguishes quota exhaustion and preserves Retry-After", async () => {
        const fetches = fetchSequence(
            jsonResponse({access_token: "access", expires_in: 3600}),
            jsonResponse(
                {error: {status: 429, message: "Too many requests", reason: "QUOTA_EXCEEDED"}},
                429,
                {"Retry-After": "120"},
            ),
        );
        const service = new SpotifyService({fetchImpl: fetches.fetchImpl, logger: silentLogger});

        const result = await service.getStatus(env);

        expect(result.data.reason).toBe("quota_exceeded");
        expect(result.data.retryAfterSeconds).toBe(120);
        expect(result.headers["Retry-After"]).toBe("120");
    });

    it("maps an ordinary 429 to rate limiting", async () => {
        const fetches = fetchSequence(
            jsonResponse({access_token: "access", expires_in: 3600}),
            jsonResponse({error: {status: 429, message: "Slow down"}}, 429),
        );
        const service = new SpotifyService({fetchImpl: fetches.fetchImpl, logger: silentLogger});

        expect((await service.getStatus(env)).data.reason).toBe("rate_limited");
    });

    it("serves transient stale data for no more than five minutes", async () => {
        let now = 0;
        const fetches = fetchSequence(
            jsonResponse({access_token: "access", expires_in: 3600}),
            jsonResponse(trackPayload),
            emptyResponse(500),
            emptyResponse(500),
        );
        const service = new SpotifyService({
            fetchImpl: fetches.fetchImpl,
            now: () => now,
            logger: silentLogger,
        });

        await service.getStatus(env);
        now += 31_000;
        const stale = await service.getStatus(env);
        now += 270_001;
        const unavailable = await service.getStatus(env);

        expect(stale.data.title).toBe("Test Track");
        expect(stale.data.stale).toBe(true);
        expect(unavailable.data.reason).toBe("playback_unavailable");
        expect(unavailable.data.stale).toBeUndefined();
    });

    it("handles missing configuration and malformed token responses", async () => {
        const configurationService = new SpotifyService({logger: silentLogger});
        expect((await configurationService.getStatus({})).data.reason).toBe("configuration_error");

        const fetches = fetchSequence(jsonResponse({expires_in: 3600}));
        const malformedService = new SpotifyService({
            fetchImpl: fetches.fetchImpl,
            logger: silentLogger,
        });
        expect((await malformedService.getStatus(env)).data.reason).toBe("invalid_response");
    });

    it("handles malformed playback responses", async () => {
        const fetches = fetchSequence(
            jsonResponse({access_token: "access", expires_in: 3600}),
            jsonResponse({unexpected: true}),
        );
        const service = new SpotifyService({fetchImpl: fetches.fetchImpl, logger: silentLogger});

        expect((await service.getStatus(env)).data.reason).toBe("invalid_response");
    });

    it("maps thrown fetch failures to a retryable network fallback", async () => {
        const fetches = fetchSequence(new Error("offline"));
        const service = new SpotifyService({fetchImpl: fetches.fetchImpl, logger: silentLogger});

        expect((await service.getStatus(env)).data.reason).toBe("network_error");
    });
});
