"use client";

import Link from "next/link";
import {useEffect, useState} from "react";
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

export default function SpotifyWidget() {
    const [song, setSong] = useState({});
    const [isLoaded, setIsLoaded] = useState(false);

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

    return (
        <>
            {isLoaded ? (
                <div className={styles.cassette}>
                    <div className={styles.cassetteContent}>
                        <div className={styles.cassetteTop}>
                            <div className={styles.reel}>
                                <div className={`${styles.reelInner} ${song.isPlaying ? styles.spinning : ''}`}></div>
                            </div>
                            <div className={styles.tape}></div>
                            <div className={styles.reel}>
                                <div className={`${styles.reelInner} ${song.isPlaying ? styles.spinning : ''}`}></div>
                            </div>
                        </div>
                        <div className={styles.songInfo}>
                            {song.isPlaying ? (
                                <Link
                                    href={song.songUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.songLink}
                                >
                                    <div className={styles.songTitle}>{song.title}</div>
                                    <div className={styles.artistName}>{song.artist}</div>
                                </Link>
                            ) : song.fallback ? (
                                <div className={`${styles.notPlaying} ${styles.fallback}`}>
                                    <div className={styles.songTitle}>{song.title || "Spotify status unavailable"}</div>
                                    <div
                                        className={styles.artistName}>{song.message || "Live playback is not available."}</div>
                                </div>
                            ) : (
                                <div className={styles.notPlaying}>
                                    <div className={styles.songTitle}>...</div>
                                    <div className={styles.artistName}>Not playing</div>
                                </div>
                            )}
                        </div>
                        <div className={styles.buttons}>
                            <div className={styles.button}></div>
                            <div className={styles.button}></div>
                            <div className={styles.button}></div>
                        </div>
                    </div>
                    <div className={styles.footer}>
                        <a
                            href="https://open.spotify.com/user/4hqui6xxvf85z9ftwmfe589ar"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.viewMore}
                        >
                            Check out my Spotify profile →
                        </a>
                    </div>
                </div>
            ) : (
                <div className={styles.loading}>
                    Loading music player...
                </div>
            )}
        </>
    );
}
