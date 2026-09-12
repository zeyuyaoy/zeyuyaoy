"use client";

import Image from "next/image";
import {useEffect, useState} from "react";
import {formatPlaybackTime, getSpotifyPlaybackProgress,} from "@/lib/spotify-playback";
import {getSpotifyPollDecision} from "@/lib/spotify-polling";
import styles from "./SpotifyWidget.module.css";

const unavailableSong = {
    isPlaying: false,
    fallback: true,
    reason: "network_error",
    title: "Spotify status unavailable",
    message: "Live listening status is not available right now.",
};

const isSpotifyResponse = (data) => (
    data !== null
    && typeof data === "object"
    && typeof data.isPlaying === "boolean"
);

function getPlaybackCopy(song) {
    if (song.stale) {
        return {
            artist: song.artist,
            status: "Playback status delayed",
            title: song.title,
        };
    }

    if (song.isPlaying) {
        return {
            artist: song.artist,
            status: "Now playing",
            title: song.title,
        };
    }

    if (song.fallback) {
        return {
            artist: song.message || "Live playback is not available.",
            status: "Spotify",
            title: song.title || "Spotify status unavailable",
        };
    }

    return {
        artist: "Not playing",
        status: "Spotify",
        title: "Tape stopped",
    };
}

function CassetteHardware({isLive = false}) {
    const hubClassName = `${styles.reelHub} ${isLive ? styles.spinning : ""}`;

    return (
        <>
            <span className={`${styles.screw} ${styles.screwTopLeft}`} aria-hidden="true"/>
            <span className={`${styles.screw} ${styles.screwTopRight}`} aria-hidden="true"/>
            <span className={`${styles.screw} ${styles.screwBottomLeft}`} aria-hidden="true"/>
            <span className={`${styles.screw} ${styles.screwBottomRight}`} aria-hidden="true"/>

            <div className={styles.tapeWindow} aria-hidden="true">
                <span className={`${styles.reel} ${styles.reelLeft}`}>
                    <span className={hubClassName}/>
                </span>
                <span className={`${styles.reel} ${styles.reelRight}`}>
                    <span className={hubClassName}/>
                </span>
            </div>

            <div className={styles.lowerDeck} aria-hidden="true">
                <span className={styles.deckHole}/>
                <span className={styles.deckPin}/>
                <span className={styles.deckSlot}/>
                <span className={styles.deckPin}/>
                <span className={styles.deckHole}/>
            </div>
        </>
    );
}

export default function SpotifyWidget() {
    const [song, setSong] = useState({});
    const [isLoaded, setIsLoaded] = useState(false);
    const [clockMs, setClockMs] = useState(() => Date.now());

    useEffect(() => {
        let timeoutId;
        let controller;
        let cancelled = false;
        let consecutiveFailures = 0;

        const scheduleNextFetch = (delay) => {
            timeoutId = window.setTimeout(fetchSpotifyData, delay);
        };

        const fetchSpotifyData = async () => {
            controller = new AbortController();
            let nextDelay;
            let stopPolling = false;

            try {
                const response = await fetch("/api/spotify", {
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(`Spotify endpoint returned ${response.status}`);
                }

                const data = await response.json();

                if (!isSpotifyResponse(data)) {
                    throw new Error("Spotify endpoint returned an invalid response");
                }

                if (cancelled) {
                    return;
                }

                setSong(data);
                setIsLoaded(true);

                const decision = getSpotifyPollDecision(data, consecutiveFailures);
                consecutiveFailures = decision.consecutiveFailures;
                nextDelay = decision.delay;
                stopPolling = decision.stop;
            } catch (error) {
                if (error.name === "AbortError" || cancelled) {
                    return;
                }

                console.error("Error fetching Spotify data:", error);
                setSong(unavailableSong);
                setIsLoaded(true);
                const decision = getSpotifyPollDecision(unavailableSong, consecutiveFailures);
                consecutiveFailures = decision.consecutiveFailures;
                nextDelay = decision.delay;
            } finally {
                if (!cancelled && !stopPolling) {
                    scheduleNextFetch(nextDelay);
                }
            }
        };

        fetchSpotifyData();

        return () => {
            cancelled = true;
            controller?.abort();
            window.clearTimeout(timeoutId);
        };
    }, []);

    const shouldAdvanceProgress = song.isPlaying
        && !song.stale
        && Number.isFinite(song.durationMs);

    useEffect(() => {
        if (!shouldAdvanceProgress) {
            return undefined;
        }

        const intervalId = window.setInterval(() => setClockMs(Date.now()), 1000);
        return () => window.clearInterval(intervalId);
    }, [shouldAdvanceProgress]);

    if (!isLoaded) {
        return (
            <div className={styles.loading} role="status">
                <div className={`${styles.cassette} ${styles.loadingCassette}`}>
                    <CassetteHardware/>
                    <div className={`${styles.trackLabel} ${styles.loadingLabel}`}>
                        <span>Loading music player…</span>
                    </div>
                </div>
            </div>
        );
    }

    const copy = getPlaybackCopy(song);
    const isLive = song.isPlaying && !song.stale;
    const hasTiming = Number.isFinite(song.durationMs) && song.durationMs > 0;
    const displayProgressMs = getSpotifyPlaybackProgress(song, clockMs);
    const elapsedTime = hasTiming ? formatPlaybackTime(displayProgressMs) : "--:--";
    const durationTime = hasTiming ? formatPlaybackTime(song.durationMs) : "--:--";
    const progressLabel = hasTiming
        ? `Track progress, ${elapsedTime} of ${durationTime}`
        : "Track progress unavailable";

    const labelContent = (
        <>
            <span className={styles.trackCopy} aria-live="polite">
                <span className={`${styles.status} ${isLive ? styles.live : ""}`}>
                    <span className={styles.statusDot} aria-hidden="true"></span>
                    {copy.status}
                </span>
                <span className={styles.songTitle}>{copy.title}</span>
                <span className={styles.artistName}>{copy.artist}</span>
            </span>
            {song.isPlaying && song.albumImageUrl ? (
                <span className={styles.albumArtwork} aria-hidden="true">
                    <Image
                        src={song.albumImageUrl}
                        alt=""
                        fill
                        sizes="42px"
                    />
                </span>
            ) : null}
        </>
    );

    return (
        <section className={styles.player} aria-label="Spotify now playing">
            <div className={styles.cassette}>
                <CassetteHardware isLive={isLive}/>

                {song.isPlaying && song.songUrl ? (
                    <a
                        href={song.songUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.trackLabel}
                        aria-label={`Open ${song.title} by ${song.artist} on Spotify`}
                    >
                        {labelContent}
                    </a>
                ) : (
                    <div className={styles.trackLabel}>{labelContent}</div>
                )}

                <div className={styles.progressRow}>
                    <time className={styles.time}>{elapsedTime}</time>
                    <progress
                        className={styles.progress}
                        aria-label={progressLabel}
                        value={hasTiming ? displayProgressMs : 0}
                        max={hasTiming ? song.durationMs : 1}
                    />
                    <time className={styles.time}>{durationTime}</time>
                </div>
            </div>

            <div className={styles.footer}>
                <span>{isLive ? "Live from Spotify" : "Listening on Spotify"}</span>
                <a
                    href="https://open.spotify.com/user/4hqui6xxvf85z9ftwmfe589ar"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.viewMore}
                >
                    View Spotify profile
                </a>
            </div>
        </section>
    );
}
