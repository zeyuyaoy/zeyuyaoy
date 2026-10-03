import { parseSpotifyTrack } from "./spotify-contract";
import { getSpotifyPlaybackProgress } from "./spotify-playback";

const NOW_PLAYING_ENDPOINT = "https://api.spotify.com/v1/me/player/currently-playing";
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";

const PLAYBACK_CACHE_MS = 30 * 1000;
const STALE_CACHE_MS = 5 * 60 * 1000;
const ACCESS_TOKEN_EXPIRY_SKEW_MS = 60 * 1000;
const FAILURE_BACKOFF_MS = [60_000, 120_000, 240_000, 300_000];

const PUBLIC_CACHE_CONTROL = "public, max-age=0, s-maxage=30, stale-while-revalidate=60";
const NO_STORE_CACHE_CONTROL = "no-store";

function freezeCachedProgress(data, now) {
  if (!data.isPlaying || !Number.isFinite(data.progressMs) || !Number.isFinite(data.durationMs)) {
    return data;
  }

  return {
    ...data,
    progressCapturedAt: now,
    progressMs: getSpotifyPlaybackProgress(data, now),
  };
}

const unavailableData = Object.freeze({
  isPlaying: false,
  fallback: true,
  reason: "unavailable",
  title: "Spotify status unavailable",
  message: "Music status is unavailable right now.",
});

const fallbackData = (reason, extra = {}) => ({
  ...unavailableData,
  reason,
  ...extra,
});

class SpotifyServiceError extends Error {
  constructor(code, { status = null, retryAfterSeconds = null, transient = false } = {}) {
    super(code);
    this.name = "SpotifyServiceError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
    this.transient = transient;
  }
}

function readSpotifyConfig(env = process.env) {
  const config = {
    clientId: env.SPOTIFY_CLIENT_ID?.trim(),
    clientSecret: env.SPOTIFY_CLIENT_SECRET?.trim(),
    refreshToken: env.SPOTIFY_REFRESH_TOKEN?.trim(),
  };

  if (Object.values(config).some((value) => !value)) {
    throw new SpotifyServiceError("configuration_error");
  }

  return config;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function retryAfterSeconds(response) {
  const raw = response.headers.get("retry-after")?.trim() ?? "";
  const value = Number(raw);
  return /^\d+$/.test(raw) && Number.isSafeInteger(value) && value <= Number.MAX_SAFE_INTEGER / 1000
    ? value
    : null;
}

function spotifyErrorReason(body) {
  if (typeof body?.error === "string") {
    return body.error;
  }

  if (typeof body?.error?.reason === "string") {
    return body.error.reason;
  }

  return null;
}

function responseResult(data, { cacheControl = PUBLIC_CACHE_CONTROL, retryAfter = null } = {}) {
  const headers = { "Cache-Control": cacheControl };

  if (retryAfter !== null) {
    headers["Retry-After"] = String(retryAfter);
  }

  return { data, headers };
}

function parseTrack(body) {
  try {
    return parseSpotifyTrack(body);
  } catch {
    throw new SpotifyServiceError("invalid_response", { transient: true });
  }
}

export class SpotifyService {
  constructor({ fetchImpl = globalThis.fetch, now = Date.now, logger = console } = {}) {
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.logger = logger;
    this.reset();
  }

  reset() {
    this.generation?.abort();
    this.generation = new AbortController();
    this.inFlight = null;
    this.config = null;
    this.activeRefreshToken = null;
    this.accessToken = null;
    this.accessTokenExpiresAt = 0;
    this.playbackCache = null;
    this.stalePlayback = null;
    this.cooldownError = null;
    this.retryAt = 0;
    this.failureCount = 0;
    this.terminalResult = null;
    this.loggedTerminalErrors = new Set();
    this.lastTransientCode = null;
  }

  syncConfig(config) {
    const changed =
      !this.config ||
      this.config.clientId !== config.clientId ||
      this.config.clientSecret !== config.clientSecret ||
      this.config.refreshToken !== config.refreshToken;

    if (changed) {
      this.reset();
      this.config = config;
      this.activeRefreshToken = config.refreshToken;
    }
  }

  clearAccessToken() {
    this.accessToken = null;
    this.accessTokenExpiresAt = 0;
  }

  clearAllCaches() {
    this.clearAccessToken();
    this.playbackCache = null;
    this.stalePlayback = null;
  }

  logTerminal(code, status) {
    if (this.loggedTerminalErrors.has(code)) {
      return;
    }

    this.loggedTerminalErrors.add(code);
    this.logger.error?.("Spotify integration needs operator attention.", { code, status });
  }

  async fetchAccessToken(generation) {
    const now = this.now();
    if (this.accessToken && now < this.accessTokenExpiresAt) {
      return this.accessToken;
    }

    const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString(
      "base64",
    );
    const response = await this.fetchImpl(TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.activeRefreshToken,
      }),
      cache: "no-store",
      signal: AbortSignal.any([generation.signal, AbortSignal.timeout(8000)]),
    });
    const body = await readJson(response);
    generation.signal.throwIfAborted();

    if (!response.ok) {
      const reason = spotifyErrorReason(body);
      if (response.status === 400 && reason === "invalid_grant") {
        throw new SpotifyServiceError("reauthorization_required", {
          status: response.status,
        });
      }

      if (response.status === 429) {
        const retryAfter = retryAfterSeconds(response);
        throw new SpotifyServiceError("rate_limited", {
          status: response.status,
          retryAfterSeconds: retryAfter,
          transient: true,
        });
      }

      const isConfigurationError = response.status === 400 || response.status === 401;
      throw new SpotifyServiceError(
        isConfigurationError ? "configuration_error" : "token_unavailable",
        {
          status: response.status,
          transient: !isConfigurationError,
        },
      );
    }

    const expiresInSeconds = body?.expires_in;
    if (
      typeof body?.access_token !== "string" ||
      !body.access_token.trim() ||
      typeof expiresInSeconds !== "number" ||
      !Number.isFinite(expiresInSeconds) ||
      expiresInSeconds <= 0
    ) {
      throw new SpotifyServiceError("invalid_response", { transient: true });
    }

    const lifetimeMs = Math.max(0, expiresInSeconds * 1000);
    const skewMs = Math.min(ACCESS_TOKEN_EXPIRY_SKEW_MS, lifetimeMs / 2);
    this.accessToken = body.access_token;
    this.accessTokenExpiresAt = now + lifetimeMs - skewMs;

    if (typeof body.refresh_token === "string" && body.refresh_token.length > 0) {
      this.activeRefreshToken = body.refresh_token;
    }

    return this.accessToken;
  }

  fetchPlayback(accessToken, generation) {
    return this.fetchImpl(NOW_PLAYING_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.any([generation.signal, AbortSignal.timeout(8000)]),
    });
  }

  cachePlayback(data) {
    if (this.lastTransientCode) {
      this.logger.info?.("Portfolio upstream", { service: "spotify", state: "recovered" });
    }
    this.lastTransientCode = null;
    this.stalePlayback = null;
    this.cooldownError = null;
    this.retryAt = 0;
    this.failureCount = 0;
    this.playbackCache = { data, timestamp: this.now() };
    return responseResult(data);
  }

  async processPlaybackResponse(response, generation) {
    generation.signal.throwIfAborted();
    if (response.status === 204) {
      return this.cachePlayback({ isPlaying: false });
    }

    if (response.status === 403) {
      this.clearAllCaches();
      return responseResult(fallbackData("limited_access"), {
        cacheControl: NO_STORE_CACHE_CONTROL,
      });
    }

    if (response.status === 429) {
      const body = await readJson(response);
      generation.signal.throwIfAborted();
      const reason =
        spotifyErrorReason(body) === "QUOTA_EXCEEDED" ? "quota_exceeded" : "rate_limited";
      const retryAfter = retryAfterSeconds(response);
      throw new SpotifyServiceError(reason, {
        status: response.status,
        retryAfterSeconds: retryAfter,
        transient: true,
      });
    }

    if (!response.ok) {
      if (response.status === 401) {
        this.clearAllCaches();
      }
      throw new SpotifyServiceError("playback_unavailable", {
        status: response.status,
        transient: response.status >= 500,
      });
    }

    const body = await readJson(response);
    generation.signal.throwIfAborted();
    const playback = parseTrack(body);

    return this.cachePlayback(
      playback.isPlaying ? { ...playback, progressCapturedAt: this.now() } : playback,
    );
  }

  terminalFailure(error) {
    this.clearAllCaches();
    this.logTerminal(error.code, error.status);
    this.terminalResult = responseResult(fallbackData(error.code), {
      cacheControl: NO_STORE_CACHE_CONTROL,
    });
    return this.terminalResult;
  }

  transientFailure(error) {
    if (this.lastTransientCode !== error.code) {
      this.logger.warn?.("Portfolio upstream", {
        service: "spotify",
        state: "degraded",
        reason: error.code,
        status: error.status,
      });
    }

    this.lastTransientCode = error.code;
    const now = this.now();
    const backoff = FAILURE_BACKOFF_MS[Math.min(this.failureCount, FAILURE_BACKOFF_MS.length - 1)];
    this.failureCount = Math.min(this.failureCount + 1, FAILURE_BACKOFF_MS.length);
    this.retryAt = now + Math.max(backoff, (error.retryAfterSeconds ?? 0) * 1000);
    this.cooldownError = error;
    if (this.playbackCache && !this.stalePlayback) {
      this.stalePlayback = freezeCachedProgress(this.playbackCache.data, now);
    }
    return this.cooldownResult();
  }

  cooldownResult() {
    const now = this.now();
    const retryAfter = Math.max(0, Math.ceil((this.retryAt - now) / 1000));
    if (this.playbackCache && now - this.playbackCache.timestamp < STALE_CACHE_MS) {
      return responseResult(
        {
          ...this.stalePlayback,
          reason: "stale",
          stale: true,
          retryAfterSeconds: retryAfter,
        },
        {
          cacheControl: NO_STORE_CACHE_CONTROL,
          retryAfter,
        },
      );
    }

    return responseResult(
      fallbackData(this.cooldownError.code, { retryAfterSeconds: retryAfter }),
      {
        cacheControl: NO_STORE_CACHE_CONTROL,
        retryAfter,
      },
    );
  }

  async getStatus(env = process.env) {
    try {
      const config = readSpotifyConfig(env);
      this.syncConfig(config);
    } catch (error) {
      if (this.config) {
        this.reset();
      }
      const spotifyError =
        error instanceof SpotifyServiceError
          ? error
          : new SpotifyServiceError("configuration_error");
      return this.terminalFailure(spotifyError);
    }

    if (this.terminalResult) {
      return this.terminalResult;
    }

    const now = this.now();
    if (this.cooldownError && now < this.retryAt) {
      return this.cooldownResult();
    }
    if (this.playbackCache && now - this.playbackCache.timestamp < PLAYBACK_CACHE_MS) {
      return responseResult(this.playbackCache.data);
    }

    if (!this.inFlight) {
      const pending = this.refreshStatus(this.generation).finally(() => {
        if (this.inFlight === pending) {
          this.inFlight = null;
        }
      });
      this.inFlight = pending;
    }
    return this.inFlight;
  }

  async refreshStatus(generation) {
    try {
      let accessToken = await this.fetchAccessToken(generation);
      generation.signal.throwIfAborted();
      let response = await this.fetchPlayback(accessToken, generation);
      generation.signal.throwIfAborted();

      if (response.status === 401) {
        this.clearAllCaches();
        accessToken = await this.fetchAccessToken(generation);
        generation.signal.throwIfAborted();
        response = await this.fetchPlayback(accessToken, generation);
      }

      return await this.processPlaybackResponse(response, generation);
    } catch (error) {
      if (generation.signal.aborted) {
        return responseResult(fallbackData("unavailable"), {
          cacheControl: NO_STORE_CACHE_CONTROL,
        });
      }
      const spotifyError =
        error instanceof SpotifyServiceError
          ? error
          : new SpotifyServiceError(
              error?.name === "TimeoutError" || error?.name === "AbortError"
                ? "timeout"
                : "network_error",
              { transient: true },
            );

      if (
        spotifyError.code === "reauthorization_required" ||
        spotifyError.code === "configuration_error"
      ) {
        return this.terminalFailure(spotifyError);
      }

      if (spotifyError.transient) {
        return this.transientFailure(spotifyError);
      }

      return responseResult(fallbackData("unavailable"), {
        cacheControl: NO_STORE_CACHE_CONTROL,
      });
    }
  }
}

export const spotifyService = new SpotifyService();
