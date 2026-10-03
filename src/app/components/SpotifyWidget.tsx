"use client";

import Image from "next/image";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { formatPlaybackTime, getSpotifyPlaybackProgress } from "@/lib/spotify-playback";
import { getSpotifyPollDecision } from "@/lib/spotify-polling";
import { parseSpotifyStatus, type SpotifyStatus } from "@/lib/spotify-contract";
import styles from "./SpotifyWidget.module.css";

const unavailableSong = {
  isPlaying: false,
  fallback: true,
  reason: "network_error",
  title: "Spotify status unavailable",
  message: "Live listening status is not available right now.",
};

function getPlaybackCopy(song: SpotifyStatus) {
  if (song.stale && song.isPlaying) {
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
    artist: "",
    status: "Spotify",
    title: "Tape stopped",
  };
}

function MarqueeText({ text = "", className }: { text?: string; className: string }) {
  const viewportRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = textRef.current;
    if (!viewport || !content) {
      return;
    }

    let disposed = false;
    const measure = () => {
      if (disposed) {
        return;
      }

      const width = content.scrollWidth;
      const gap = Number.parseFloat(getComputedStyle(content.parentElement!).columnGap) || 0;
      setDistance(width > viewport.clientWidth + 1 ? width + gap : 0);
    };

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(content);

    const appearanceObserver = new MutationObserver(measure);
    appearanceObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-font", "data-size"],
    });
    document.fonts.addEventListener("loadingdone", measure);
    void document.fonts.ready.then(measure);
    measure();

    return () => {
      disposed = true;
      observer.disconnect();
      appearanceObserver.disconnect();
      document.fonts.removeEventListener("loadingdone", measure);
    };
  }, [text]);

  const marqueeStyle = {
    "--marquee-distance": `${-distance}px`,
    "--marquee-duration": `${distance / 28 + 2}s`,
  } as CSSProperties;

  return (
    <span ref={viewportRef} className={className} title={text}>
      <span
        className={`${styles.marqueeTrack} ${distance ? styles.marqueeActive : ""}`}
        style={marqueeStyle}
      >
        <span ref={textRef} className={styles.marqueeText}>
          {text}
        </span>
        {distance > 0 && (
          <span className={styles.marqueeRepeat} aria-hidden="true">
            {text}
          </span>
        )}
      </span>
    </span>
  );
}

function CassetteHardware({ isLive = false }) {
  const hubClassName = `${styles.reelHub} ${isLive ? styles.spinning : ""}`;

  return (
    <>
      <span className={`${styles.screw} ${styles.screwTopLeft}`} aria-hidden="true" />
      <span className={`${styles.screw} ${styles.screwTopRight}`} aria-hidden="true" />
      <span className={`${styles.screw} ${styles.screwBottomLeft}`} aria-hidden="true" />
      <span className={`${styles.screw} ${styles.screwBottomRight}`} aria-hidden="true" />

      <div className={styles.tapeWindow} aria-hidden="true">
        <span className={`${styles.reel} ${styles.reelLeft}`}>
          <span className={hubClassName} />
        </span>
        <span className={`${styles.reel} ${styles.reelRight}`}>
          <span className={hubClassName} />
        </span>
      </div>

      <div className={styles.lowerDeck} aria-hidden="true">
        <span className={styles.deckHole} />
        <span className={styles.deckPin} />
        <span className={styles.deckSlot} />
        <span className={styles.deckPin} />
        <span className={styles.deckHole} />
      </div>
    </>
  );
}

export default function SpotifyWidget() {
  const [song, setSong] = useState<SpotifyStatus>({ isPlaying: false });
  const [isLoaded, setIsLoaded] = useState(false);
  const [clockMs, setClockMs] = useState(() => Date.now());

  useEffect(() => {
    let timeoutId: number | undefined;
    let controller: AbortController | undefined;
    let cancelled = false;
    let consecutiveFailures = 0;

    const scheduleNextFetch = (delay: number) => {
      timeoutId = window.setTimeout(fetchSpotifyData, delay);
    };

    const fetchSpotifyData = async () => {
      const requestController = new AbortController();
      controller = requestController;

      const deadline = window.setTimeout(() => requestController.abort(), 40_000);
      let nextDelay = 30_000;
      let stopPolling = false;

      try {
        const response = await fetch("/api/spotify", {
          signal: requestController.signal,
        });

        if (!response.ok) {
          throw new Error(`Spotify endpoint returned ${response.status}`);
        }

        const data = parseSpotifyStatus(await response.json());

        if (cancelled) {
          return;
        }

        setSong(data);
        setIsLoaded(true);

        const decision = getSpotifyPollDecision(data, consecutiveFailures);
        consecutiveFailures = decision.consecutiveFailures;
        nextDelay = decision.delay ?? 30_000;
        stopPolling = decision.stop;
      } catch {
        if (cancelled) {
          return;
        }

        setSong(unavailableSong);
        setIsLoaded(true);

        const decision = getSpotifyPollDecision(unavailableSong, consecutiveFailures);
        consecutiveFailures = decision.consecutiveFailures;
        nextDelay = decision.delay ?? 30_000;
      } finally {
        window.clearTimeout(deadline);
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

  const shouldAdvanceProgress = song.isPlaying && !song.stale && Number.isFinite(song.durationMs);

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
        <div className={styles.cassette}>
          <CassetteHardware />
          <div className={`${styles.trackLabel} ${styles.loadingLabel}`}>
            <span>Loading music player…</span>
          </div>
        </div>
      </div>
    );
  }

  const copy = getPlaybackCopy(song);
  const isLive = song.isPlaying && !song.stale;
  const durationMs = song.durationMs ?? 0;
  const hasTiming = Number.isFinite(durationMs) && durationMs > 0;
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
        <MarqueeText key={`title:${copy.title}`} text={copy.title} className={styles.songTitle} />
        <MarqueeText
          key={`artist:${copy.artist}`}
          text={copy.artist}
          className={styles.artistName}
        />
      </span>
      {song.isPlaying && song.albumImageUrl ? (
        <span className={styles.albumArtwork} aria-hidden="true">
          <Image src={song.albumImageUrl} alt="" fill sizes="(max-width: 800px) 64px, 52px" />
        </span>
      ) : null}
    </>
  );

  return (
    <section className={styles.player} aria-label="Spotify now playing">
      <div className={styles.cassette}>
        <CassetteHardware isLive={isLive} />

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
            max={hasTiming ? durationMs : 1}
          />
          <time className={styles.time}>{durationTime}</time>
        </div>
      </div>
    </section>
  );
}
