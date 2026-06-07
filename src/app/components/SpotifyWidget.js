"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import styles from "./SpotifyWidget.module.css";

export default function SpotifyWidget() {
    const [song, setSong] = useState({});
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const fetchSpotifyData = async () => {
            try {
                const response = await fetch("/api/spotify");
                const data = await response.json();
                setSong(data);
                setIsLoaded(true);
            } catch (error) {
                console.error("Error fetching Spotify data:", error);
                setSong({
                    isPlaying: false,
                    fallback: true,
                    reason: "network_error",
                    title: "Spotify status unavailable",
                    message: "Live listening status is not available right now.",
                });
                setIsLoaded(true);
            }
        };

        fetchSpotifyData().then(r => console.log("Spotify data fetched:", r));

        const spotifyInterval = setInterval(fetchSpotifyData, 30 * 1000);
        return () => clearInterval(spotifyInterval);
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
                                    <div className={styles.artistName}>{song.message || "Live playback is not available."}</div>
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
