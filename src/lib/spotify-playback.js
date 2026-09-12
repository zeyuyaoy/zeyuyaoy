export function clampPlaybackProgress(progressMs, durationMs) {
    const safeDuration = Number.isFinite(durationMs) && durationMs > 0
        ? durationMs
        : 0;
    const safeProgress = Number.isFinite(progressMs) && progressMs > 0
        ? progressMs
        : 0;

    return Math.min(safeProgress, safeDuration);
}

export function getSpotifyPlaybackProgress(playback, now = Date.now()) {
    const progress = clampPlaybackProgress(playback?.progressMs, playback?.durationMs);

    if (!playback?.isPlaying || playback.stale) {
        return progress;
    }

    const capturedAt = Number(playback.progressCapturedAt);
    const elapsed = Number.isFinite(capturedAt)
        ? Math.max(0, now - capturedAt)
        : 0;

    return clampPlaybackProgress(progress + elapsed, playback.durationMs);
}

export function formatPlaybackTime(milliseconds) {
    const totalSeconds = Math.max(0, Math.floor((Number(milliseconds) || 0) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
