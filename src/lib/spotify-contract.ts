import {isRecord, trustedHttpsUrl, UpstreamError} from "./upstream";

export interface SpotifyStatus {
    isPlaying: boolean;
    title?: string;
    artist?: string;
    album?: string;
    songUrl?: string;
    albumImageUrl?: string | null;
    durationMs?: number | null;
    progressMs?: number | null;
    progressCapturedAt?: number;
    fallback?: boolean;
    stale?: boolean;
    reason?: string;
    message?: string;
    retryAfterSeconds?: number;
}

const nonempty = (value: unknown): value is string => typeof value === "string" && Boolean(value.trim());
const nonnegative = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

export function parseSpotifyStatus(data: unknown): SpotifyStatus {
    if (!isRecord(data) || typeof data.isPlaying !== "boolean") {
        throw new UpstreamError("invalid_response");
    }

    for (const field of ["title", "artist", "album", "reason", "message"] as const) {
        if (data[field] !== undefined && typeof data[field] !== "string") {
            throw new UpstreamError("invalid_response");
        }
    }

    for (const field of ["stale", "fallback"] as const) {
        if (data[field] !== undefined && typeof data[field] !== "boolean") {
            throw new UpstreamError("invalid_response");
        }
    }

    if (data.isPlaying && (!nonempty(data.title) || !nonempty(data.artist)
        || !trustedHttpsUrl(data.songUrl, "open.spotify.com"))) {
        throw new UpstreamError("invalid_response");
    }

    return {
        isPlaying: data.isPlaying,
        title: typeof data.title === "string" ? data.title : undefined,
        artist: typeof data.artist === "string" ? data.artist : undefined,
        album: typeof data.album === "string" ? data.album : undefined,
        songUrl: trustedHttpsUrl(data.songUrl, "open.spotify.com") ? data.songUrl : undefined,
        albumImageUrl: trustedHttpsUrl(data.albumImageUrl, "i.scdn.co") ? data.albumImageUrl : null,
        durationMs: nonnegative(data.durationMs) && data.durationMs > 0 ? data.durationMs : null,
        progressMs: nonnegative(data.progressMs) ? data.progressMs : null,
        progressCapturedAt: nonnegative(data.progressCapturedAt) ? data.progressCapturedAt : undefined,
        fallback: data.fallback === true,
        stale: data.stale === true,
        reason: typeof data.reason === "string" ? data.reason : undefined,
        message: typeof data.message === "string" ? data.message : undefined,
        retryAfterSeconds: nonnegative(data.retryAfterSeconds) ? data.retryAfterSeconds : undefined,
    };
}

export function parseSpotifyTrack(body: unknown): SpotifyStatus {
    if (!isRecord(body) || typeof body.is_playing !== "boolean") {
        throw new UpstreamError("invalid_response");
    }

    if (!body.is_playing || body.item === null) {
        return {isPlaying: false};
    }

    if (!isRecord(body.item)) {
        throw new UpstreamError("invalid_response");
    }

    const item = body.item;
    if ((item.type ?? body.currently_playing_type) !== "track") {
        return {isPlaying: false};
    }

    if (!nonempty(item.name) || !Array.isArray(item.artists) || !item.artists.length
        || !isRecord(item.external_urls) || !trustedHttpsUrl(item.external_urls.spotify, "open.spotify.com")) {
        throw new UpstreamError("invalid_response");
    }

    const artists = item.artists.map((artist: unknown) => {
        if (!isRecord(artist) || !nonempty(artist.name)) {
            throw new UpstreamError("invalid_response");
        }
        return artist.name;
    });

    if (item.album != null && (!isRecord(item.album)
        || (item.album.name !== undefined && typeof item.album.name !== "string"))) {
        throw new UpstreamError("invalid_response");
    }

    const album = isRecord(item.album) ? item.album : {};
    const image = Array.isArray(album.images) && isRecord(album.images[0]) ? album.images[0].url : null;
    const duration = nonnegative(item.duration_ms) && item.duration_ms > 0 ? Math.round(item.duration_ms) : null;
    const progress = nonnegative(body.progress_ms) ? Math.round(body.progress_ms) : null;

    return {
        isPlaying: true,
        title: item.name,
        artist: artists.join(", ").replace(/,(?!.*,)/g, " and"),
        songUrl: item.external_urls.spotify,
        album: typeof album.name === "string" ? album.name : "",
        albumImageUrl: trustedHttpsUrl(image, "i.scdn.co") ? image : null,
        durationMs: duration,
        progressMs: progress === null ? null : Math.min(progress, duration ?? progress),
    };
}
